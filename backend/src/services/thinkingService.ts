import { db } from '../lib/db';
import { NotFoundError, ForbiddenError } from '../lib/errors';
import crypto from 'crypto';

export const noteService = {
  /**
   * Create a note
   */
  async createNote(
    projectId: string,
    userId: string,
    title: string,
    content: string
  ) {
    const note = await db.note.create({
      data: {
        projectId,
        userId,
        title,
        content,
      },
    });

    return note;
  },

  /**
   * Get all notes for a project
   */
  async getNotesForProject(projectId: string, userId: string) {
    // Verify project access
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    const hasAccess =
      project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this project');
    }

    const notes = await db.note.findMany({
      where: { projectId },
      include: {
        insights: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return notes;
  },

  /**
   * Get a single note
   */
  async getNote(noteId: string, userId: string) {
    const note = await db.note.findUnique({
      where: { id: noteId },
      include: {
        project: { include: { workspace: true } },
        insights: true,
      },
    });

    if (!note) {
      throw new NotFoundError('Note');
    }

    // Verify access
    const hasAccess =
      note.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: note.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this note');
    }

    return note;
  },

  /**
   * Update a note
   */
  async updateNote(
    noteId: string,
    userId: string,
    data: { title?: string; content?: string }
  ) {
    const note = await db.note.findUnique({
      where: { id: noteId },
      include: { project: { include: { workspace: true } } },
    });

    if (!note) {
      throw new NotFoundError('Note');
    }

    // Verify access
    const hasAccess =
      note.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: note.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this note');
    }

    const updated = await db.note.update({
      where: { id: noteId },
      data,
      include: { insights: true },
    });

    return updated;
  },

  /**
   * Delete a note
   */
  async deleteNote(noteId: string, userId: string) {
    const note = await db.note.findUnique({
      where: { id: noteId },
      include: { project: { include: { workspace: true } } },
    });

    if (!note) {
      throw new NotFoundError('Note');
    }

    // Verify access
    const hasAccess =
      note.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: note.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this note');
    }

    await db.note.delete({
      where: { id: noteId },
    });
  },

  /**
   * Check if note content has changed significantly (for insight generation)
   */
  computeContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  },

  /**
   * Check if content hash has changed from last extraction
   */
  hasContentChanged(note: any, currentContent: string): boolean {
    const newHash = this.computeContentHash(currentContent);
    return note.lastInsightExtractionHash !== newHash;
  },
};

export const insightService = {
  /**
   * Create an insight
   */
  async createInsight(
    projectId: string,
    userId: string,
    content: string,
    source: 'AI' | 'USER',
    noteId?: string,
    confidenceScore?: number
  ) {
    const insight = await db.insight.create({
      data: {
        projectId,
        userId,
        noteId,
        content,
        source,
        confidenceScore: confidenceScore || (source === 'AI' ? 0.7 : 0.5),
      },
    });

    return insight;
  },

  /**
   * Get all insights for a project
   */
  async getInsightsForProject(projectId: string, userId: string) {
    // Verify project access
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    const hasAccess =
      project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this project');
    }

    const insights = await db.insight.findMany({
      where: { projectId },
      include: {
        note: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return insights;
  },

  /**
   * Get insights for a note
   */
  async getInsightsForNote(noteId: string, userId: string) {
    const note = await db.note.findUnique({
      where: { id: noteId },
      include: {
        project: { include: { workspace: true } },
        insights: true,
      },
    });

    if (!note) {
      throw new NotFoundError('Note');
    }

    // Verify access
    const hasAccess =
      note.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: note.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this note');
    }

    return note.insights;
  },

  /**
   * Delete an insight
   */
  async deleteInsight(insightId: string, userId: string) {
    const insight = await db.insight.findUnique({
      where: { id: insightId },
      include: {
        project: { include: { workspace: true } },
      },
    });

    if (!insight) {
      throw new NotFoundError('Insight');
    }

    // Verify access
    const hasAccess =
      insight.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: insight.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this insight');
    }

    await db.insight.delete({
      where: { id: insightId },
    });
  },

  /**
   * Update insight confidence score
   */
  async updateConfidenceScore(insightId: string, userId: string, confidenceScore: number) {
    const insight = await db.insight.findUnique({
      where: { id: insightId },
      include: {
        project: { include: { workspace: true } },
      },
    });

    if (!insight) {
      throw new NotFoundError('Insight');
    }

    // Verify access
    const hasAccess =
      insight.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: insight.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this insight');
    }

    const updated = await db.insight.update({
      where: { id: insightId },
      data: { confidenceScore },
    });

    return updated;
  },
};
