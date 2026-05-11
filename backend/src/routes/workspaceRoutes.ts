// Workspace routes — create, list, update, delete workspaces and manage members.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';

const requireUserId = (req: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = req.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

const CreateSchema = z.object({
  name:        z.string().min(1).max(80),
  description: z.string().max(300).optional(),
});

const UpdateSchema = z.object({
  name:        z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
});

const InviteSchema = z.object({
  userId: z.string().min(1),
  role:   z.enum(['editor', 'viewer']).default('editor'),
});

export default async function workspaceRoutes(fastify: FastifyInstance) {

  // GET /workspaces — list workspaces the user owns or belongs to.
  fastify.get('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const [owned, memberships] = await Promise.all([
      db.workspace.findMany({
        where:   { ownerId: userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      db.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true, role: true },
      }),
    ]);

    const memberIds = memberships
      .filter((m) => !owned.find((w) => w.id === m.workspaceId))
      .map((m) => m.workspaceId);

    const memberWorkspaces = memberIds.length > 0
      ? await db.workspace.findMany({ where: { id: { in: memberIds }, deletedAt: null } })
      : [];

    const roleMap = Object.fromEntries(memberships.map((m) => [m.workspaceId, m.role]));

    const all = [
      ...owned.map((w) => ({ ...w, role: 'owner' })),
      ...memberWorkspaces.map((w) => ({ ...w, role: roleMap[w.id] ?? 'editor' })),
    ];

    reply.code(200).send({ ok: true, data: { workspaces: all } });
  });

  // POST /workspaces — create a workspace.
  fastify.post('/', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;

    const body = CreateSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });
    }

    const baseSlug = slugify(body.data.name);
    // Ensure slug uniqueness with a numeric suffix.
    let slug = baseSlug;
    let attempt = 0;
    while (await db.workspace.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
    }

    const workspace = await db.workspace.create({
      data: {
        ownerId:     userId,
        name:        body.data.name,
        slug,
        description: body.data.description ?? null,
      },
    });

    // Owner is also a member with role 'owner'.
    await db.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: 'owner' },
    });

    reply.code(201).send({ ok: true, data: { workspace } });
  });

  // GET /workspaces/:id — fetch a single workspace (member or owner only).
  fastify.get('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const [workspace, membership] = await Promise.all([
      db.workspace.findUnique({ where: { id, deletedAt: null } }),
      db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: id, userId } } }),
    ]);

    if (!workspace || !membership) {
      return reply.code(404).send({ ok: false, error: 'workspace not found' });
    }

    const members = await db.workspaceMember.findMany({ where: { workspaceId: id } });

    reply.code(200).send({ ok: true, data: { workspace, members, role: membership.role } });
  });

  // PATCH /workspaces/:id — update name/description (owner only).
  fastify.patch('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const workspace = await db.workspace.findUnique({ where: { id, ownerId: userId, deletedAt: null } });
    if (!workspace) return reply.code(404).send({ ok: false, error: 'workspace not found' });

    const body = UpdateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const updated = await db.workspace.update({
      where: { id },
      data:  { name: body.data.name, description: body.data.description },
    });

    reply.code(200).send({ ok: true, data: { workspace: updated } });
  });

  // DELETE /workspaces/:id — soft-delete (owner only).
  fastify.delete('/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const workspace = await db.workspace.findUnique({ where: { id, ownerId: userId } });
    if (!workspace) return reply.code(404).send({ ok: false, error: 'workspace not found' });

    await db.workspace.update({ where: { id }, data: { deletedAt: new Date() } });
    reply.code(200).send({ ok: true });
  });

  // POST /workspaces/:id/members — invite a user.
  fastify.post('/:id/members', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };

    const workspace = await db.workspace.findUnique({ where: { id, ownerId: userId, deletedAt: null } });
    if (!workspace) return reply.code(404).send({ ok: false, error: 'workspace not found' });

    const body = InviteSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const member = await db.workspaceMember.upsert({
      where:  { workspaceId_userId: { workspaceId: id, userId: body.data.userId } },
      create: { workspaceId: id, userId: body.data.userId, role: body.data.role, invitedBy: userId },
      update: { role: body.data.role },
    });

    reply.code(200).send({ ok: true, data: { member } });
  });

  // DELETE /workspaces/:id/members/:memberId — remove a member (owner only).
  fastify.delete('/:id/members/:memberId', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const { id, memberId } = req.params as { id: string; memberId: string };

    const workspace = await db.workspace.findUnique({ where: { id, ownerId: userId } });
    if (!workspace) return reply.code(404).send({ ok: false, error: 'workspace not found' });

    if (memberId === userId) return reply.code(400).send({ ok: false, error: 'cannot remove owner' });

    await db.workspaceMember.deleteMany({ where: { workspaceId: id, userId: memberId } });
    reply.code(200).send({ ok: true });
  });
}
