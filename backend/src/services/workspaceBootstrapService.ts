import { db } from '../lib/db.js';

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

export const workspaceBootstrapService = {
  async ensureWorkspaceForUser(workspaceId: string, userId: string): Promise<void> {
    if (!workspaceId) return;

    const existing = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
    if (existing) {
      await db.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId } },
        create: { workspaceId, userId, role: 'owner' },
        update: {},
      }).catch(() => undefined);
      return;
    }

    const baseSlug = slugify(workspaceId);
    let slug = baseSlug || `ws-${workspaceId.slice(0, 8).toLowerCase()}`;
    let attempt = 0;
    while (await db.workspace.findUnique({ where: { slug }, select: { id: true } })) {
      attempt += 1;
      slug = `${baseSlug || 'ws'}-${attempt}`;
    }

    await db.$transaction(async (tx) => {
      await tx.workspace.create({
        data: {
          id: workspaceId,
          ownerId: userId,
          name: `Workspace ${workspaceId.slice(0, 6)}`,
          slug,
          description: null,
        },
      });

      await tx.workspaceMember.create({
        data: { workspaceId, userId, role: 'owner' },
      });

      await tx.workspaceMetrics.create({
        data: { workspaceId },
      }).catch(() => undefined);

      await tx.workspaceContext.create({
        data: { workspaceId },
      }).catch(() => undefined);
    });
  },
};
