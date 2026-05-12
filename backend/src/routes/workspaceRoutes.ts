// Workspace routes — create, list, update, delete workspaces and manage members.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { requireWorkspaceRole } from '../lib/workspaceAuth.js';
import { wsManager } from '../services/websocketManager.js';
import { workspaceActivityService } from '../services/workspaceActivityService.js';

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
  logoUrl:        z.string().url().optional(),
  startupStage:   z.string().max(60).optional(),
  industry:       z.string().max(80).optional(),
  productCategory:z.string().max(80).optional(),
  businessModel:  z.string().max(80).optional(),
  icp:            z.string().max(500).optional(),
  aiStrategy:     z.string().max(1000).optional(),
});

const UpdateSchema = z.object({
  name:        z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
  logoUrl:        z.string().url().optional(),
  startupStage:   z.string().max(60).optional(),
  industry:       z.string().max(80).optional(),
  productCategory:z.string().max(80).optional(),
  businessModel:  z.string().max(80).optional(),
  icp:            z.string().max(500).optional(),
  aiStrategy:     z.string().max(1000).optional(),
});

const InviteSchema = z.object({
  userId: z.string().min(1),
  role:   z.enum(['admin', 'editor', 'viewer']).default('editor'),
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

    const workspace = await db.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          ownerId:     userId,
          name:        body.data.name,
          slug,
          description: body.data.description ?? null,
          logoUrl:        body.data.logoUrl ?? null,
          startupStage:   body.data.startupStage ?? null,
          industry:       body.data.industry ?? null,
          productCategory:body.data.productCategory ?? null,
          businessModel:  body.data.businessModel ?? null,
          icp:            body.data.icp ?? null,
          aiStrategy:     body.data.aiStrategy ?? null,
        },
      });

      // Owner is also a member with role 'owner'.
      await tx.workspaceMember.create({
        data: { workspaceId: created.id, userId, role: 'owner' },
      });

      // Create metric/context rows (best-effort initialization).
      await tx.workspaceMetrics.create({
        data: { workspaceId: created.id },
      }).catch(() => undefined);

      await tx.workspaceContext.create({
        data: { workspaceId: created.id },
      }).catch(() => undefined);

      return created;
    });

    workspaceActivityService.create({
      workspaceId: workspace.id,
      actorId: userId,
      eventType: 'workspace.created',
      title: `Workspace created: ${workspace.name}`,
      metadata: { workspaceId: workspace.id },
    }).catch(() => undefined);

    reply.code(201).send({ ok: true, data: { workspace } });
  });

  // GET /workspaces/:id — fetch a single workspace (member or owner only).
  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const auth = await requireWorkspaceRole(req, reply, id, 'viewer');
    if (!auth) return;

    const [workspace, members, metrics, context] = await Promise.all([
      db.workspace.findUnique({ where: { id, deletedAt: null } }),
      db.workspaceMember.findMany({ where: { workspaceId: id } }),
      db.workspaceMetrics.findUnique({ where: { workspaceId: id } }).catch(() => null),
      db.workspaceContext.findUnique({ where: { workspaceId: id } }).catch(() => null),
    ]);

    if (!workspace) {
      return reply.code(404).send({ ok: false, error: 'workspace not found' });
    }

    reply.code(200).send({
      ok: true,
      data: {
        workspace,
        members,
        role: auth.role,
        metrics,
        context,
        realtime: { activeConnections: wsManager.activeCountByWorkspace(id) },
      },
    });
  });

  // PATCH /workspaces/:id — update name/description (owner only).
  fastify.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const auth = await requireWorkspaceRole(req, reply, id, 'admin');
    if (!auth) return;

    const workspace = await db.workspace.findUnique({ where: { id, deletedAt: null } });
    if (!workspace) return reply.code(404).send({ ok: false, error: 'workspace not found' });

    const body = UpdateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    const updated = await db.workspace.update({
      where: { id },
      data: {
        name: body.data.name,
        description: body.data.description,
        logoUrl:        body.data.logoUrl,
        startupStage:   body.data.startupStage,
        industry:       body.data.industry,
        productCategory:body.data.productCategory,
        businessModel:  body.data.businessModel,
        icp:            body.data.icp,
        aiStrategy:     body.data.aiStrategy,
      },
    });

    workspaceActivityService.create({
      workspaceId: id,
      actorId: auth.userId,
      eventType: 'workspace.updated',
      title: `Workspace updated: ${updated.name}`,
      metadata: { fields: Object.keys(body.data) },
    }).catch(() => undefined);

    reply.code(200).send({ ok: true, data: { workspace: updated } });
  });

  // DELETE /workspaces/:id — soft-delete (owner only).
  fastify.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const auth = await requireWorkspaceRole(req, reply, id, 'owner');
    if (!auth) return;

    const workspace = await db.workspace.findUnique({ where: { id, deletedAt: null } });
    if (!workspace) return reply.code(404).send({ ok: false, error: 'workspace not found' });

    await db.workspace.update({ where: { id }, data: { deletedAt: new Date() } });

    workspaceActivityService.create({
      workspaceId: id,
      actorId: auth.userId,
      eventType: 'workspace.deleted',
      title: `Workspace deleted: ${workspace.name}`,
    }).catch(() => undefined);

    reply.code(200).send({ ok: true });
  });

  // POST /workspaces/:id/members — invite a user.
  fastify.post('/:id/members', async (req, reply) => {
    const { id } = req.params as { id: string };

    const auth = await requireWorkspaceRole(req, reply, id, 'admin');
    if (!auth) return;

    const workspace = await db.workspace.findUnique({ where: { id, deletedAt: null } });
    if (!workspace) return reply.code(404).send({ ok: false, error: 'workspace not found' });

    const body = InviteSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error.issues[0]?.message });

    // Only owner can grant admin.
    if (body.data.role === 'admin' && auth.role !== 'owner') {
      return reply.code(403).send({ ok: false, error: 'insufficient_role' });
    }

    const member = await db.workspaceMember.upsert({
      where:  { workspaceId_userId: { workspaceId: id, userId: body.data.userId } },
      create: { workspaceId: id, userId: body.data.userId, role: body.data.role, invitedBy: auth.userId },
      update: { role: body.data.role },
    });

    workspaceActivityService.create({
      workspaceId: id,
      actorId: auth.userId,
      eventType: 'workspace.member_invited',
      title: `Member invited (${body.data.role}): ${body.data.userId}`,
      metadata: { invitedUserId: body.data.userId, role: body.data.role },
    }).catch(() => undefined);

    reply.code(200).send({ ok: true, data: { member } });
  });

  // DELETE /workspaces/:id/members/:memberId — remove a member (owner only).
  fastify.delete('/:id/members/:memberId', async (req, reply) => {
    const { id, memberId } = req.params as { id: string; memberId: string };

    const auth = await requireWorkspaceRole(req, reply, id, 'admin');
    if (!auth) return;

    const workspace = await db.workspace.findUnique({ where: { id, deletedAt: null } });
    if (!workspace) return reply.code(404).send({ ok: false, error: 'workspace not found' });

    if (memberId === auth.userId) return reply.code(400).send({ ok: false, error: 'cannot remove self' });

    await db.workspaceMember.deleteMany({ where: { workspaceId: id, userId: memberId } });

    workspaceActivityService.create({
      workspaceId: id,
      actorId: auth.userId,
      eventType: 'workspace.member_removed',
      title: `Member removed: ${memberId}`,
      metadata: { removedUserId: memberId },
    }).catch(() => undefined);

    reply.code(200).send({ ok: true });
  });

  // GET /workspaces/:id/dashboard — workspace-scoped overview for dashboard cards.
  fastify.get('/:id/dashboard', async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = await requireWorkspaceRole(req, reply, id, 'viewer');
    if (!auth) return;

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalSignals,
      extensionSignals,
      weeklyCaptures,
      competitorInsights,
      marketSignals,
      productBrainTotal,
      jobsCompleted,
      jobsFailed,
      topDomains,
      recentActivity,
      session,
    ] = await Promise.all([
      db.productBrainEntry.count({ where: { workspaceId: id } }),
      db.productBrainEntry.count({ where: { workspaceId: id, sourceJobId: { not: null } } }),
      db.productBrainEntry.count({ where: { workspaceId: id, createdAt: { gte: since7d } } }),
      db.competitorInsight.count({ where: { workspaceId: id } }),
      db.marketSignal.count({ where: { workspaceId: id } }),
      db.productBrainEntry.count({ where: { workspaceId: id } }),
      db.analysisJob.count({ where: { workspaceId: id, status: 'completed' } }),
      db.analysisJob.count({ where: { workspaceId: id, status: 'failed' } }),
      db.competitorInsight.groupBy({
        by: ['domain'],
        where: { workspaceId: id, capturedAt: { gte: since30d } },
        _count: { _all: true },
        orderBy: { _count: { domain: 'desc' } },
        take: 5,
      }).catch(() => []),
      db.workspaceActivity.findMany({
        where: { workspaceId: id },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }).catch(() => []),
      db.extensionSession.findFirst({
        where: { workspaceId: id },
        orderBy: { lastSeenAt: 'desc' },
      }).catch(() => null),
    ]);

    const msSinceHeartbeat = session ? Date.now() - session.lastSeenAt.getTime() : null;
    const extensionConnected = msSinceHeartbeat != null ? msSinceHeartbeat < 90_000 : false;

    reply.code(200).send({
      ok: true,
      data: {
        totalSignals,
        extensionSignals,
        weeklyCaptures,
        competitorInsights,
        marketSignals,
        productBrainTotal,
        aiJobsCompleted: jobsCompleted,
        aiJobsFailed: jobsFailed,
        topDomains: (topDomains as any[]).map((d: any) => ({ domain: d.domain, count: d._count._all })),
        extension: session ? {
          connected: extensionConnected,
          version: session.extensionVersion,
          browser: session.browserType,
          lastSeenAt: session.lastSeenAt.toISOString(),
        } : { connected: false },
        realtimeConnections: wsManager.activeCountByWorkspace(id),
        recentActivity: recentActivity.map((a) => ({
          id: a.id,
          type: a.eventType,
          description: a.title,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  });

  // GET /workspaces/:id/activity — persisted realtime activity stream.
  fastify.get('/:id/activity', async (req, reply) => {
    const { id } = req.params as { id: string };
    const auth = await requireWorkspaceRole(req, reply, id, 'viewer');
    if (!auth) return;

    const QuerySchema = z.object({
      limit: z.coerce.number().min(1).max(100).default(50),
      eventType: z.string().max(80).optional(),
    });

    const parsed = QuerySchema.safeParse((req as any).query);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Invalid query' });
    }

    const items = await db.workspaceActivity.findMany({
      where: {
        workspaceId: id,
        eventType: parsed.data.eventType ? parsed.data.eventType : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: parsed.data.limit,
    });

    reply.code(200).send({
      ok: true,
      data: {
        items: items.map((a) => ({
          id: a.id,
          workspaceId: a.workspaceId,
          actorId: a.actorId,
          eventType: a.eventType,
          title: a.title,
          description: a.description,
          entityType: a.entityType,
          entityId: a.entityId,
          createdAt: a.createdAt.toISOString(),
          metadata: a.metadata ? JSON.parse(a.metadata) : null,
        })),
      },
    });
  });
}
