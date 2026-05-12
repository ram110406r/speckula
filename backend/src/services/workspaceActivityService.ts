import { db } from '../lib/db.js';
import { publishWorkspaceEvent } from './eventBus.js';

export interface CreateWorkspaceActivityInput {
  workspaceId: string;
  actorId: string;
  eventType: string;
  title: string;
  description?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const workspaceActivityService = {
  async create(input: CreateWorkspaceActivityInput) {
    const row = await db.workspaceActivity.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        eventType: input.eventType,
        title: input.title,
        description: input.description ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    publishWorkspaceEvent({
      type: 'activity.created',
      workspaceId: input.workspaceId,
      userId: input.actorId,
      data: {
        id: row.id,
        eventType: row.eventType,
        title: row.title,
        description: row.description,
        createdAt: row.createdAt.toISOString(),
      },
    }).catch(() => undefined);

    return row;
  },
};
