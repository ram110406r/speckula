import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from './db.js';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

const roleRank: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export const requireUserId = (req: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = req.userId;
  if (!uid) {
    reply.code(401).send({ ok: false, error: 'unauthorized' });
    return null;
  }
  return uid;
};

export async function requireWorkspaceRole(
  req: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
  minRole: WorkspaceRole = 'viewer'
): Promise<{ userId: string; role: WorkspaceRole } | null> {
  const userId = requireUserId(req, reply);
  if (!userId) return null;

  const [workspace, membership] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId, deletedAt: null }, select: { id: true } }),
    db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    }),
  ]);

  if (!workspace) {
    reply.code(404).send({ ok: false, error: 'workspace not found' });
    return null;
  }

  if (!membership) {
    reply.code(403).send({ ok: false, error: 'forbidden' });
    return null;
  }

  const role = (membership.role as WorkspaceRole) ?? 'viewer';
  const ok = (roleRank[role] ?? 0) >= (roleRank[minRole] ?? 0);
  if (!ok) {
    reply.code(403).send({ ok: false, error: 'insufficient_role' });
    return null;
  }

  return { userId, role };
}
