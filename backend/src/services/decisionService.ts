import { db } from '../lib/db';
import { NotFoundError, ForbiddenError } from '../lib/errors';

export const decisionService = {
  /**
   * Create a decision
   */
  async createDecision(
    projectId: string,
    userId: string,
    title: string,
    description: string,
    confidenceScore = 0.5
  ) {
    const decision = await db.decision.create({
      data: {
        projectId,
        userId,
        title,
        description,
        confidenceScore,
      },
    });

    return decision;
  },

  /**
   * Get all decisions for a project
   */
  async getDecisionsForProject(projectId: string, userId: string) {
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

    const decisions = await db.decision.findMany({
      where: { projectId },
      include: {
        tradeoffs: true,
        outcomes: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return decisions;
  },

  /**
   * Get a single decision
   */
  async getDecision(decisionId: string, userId: string) {
    const decision = await db.decision.findUnique({
      where: { id: decisionId },
      include: {
        project: { include: { workspace: true } },
        tradeoffs: true,
        outcomes: true,
      },
    });

    if (!decision) {
      throw new NotFoundError('Decision');
    }

    // Verify access
    const hasAccess =
      decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this decision');
    }

    return decision;
  },

  /**
   * Update a decision
   */
  async updateDecision(
    decisionId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
      status?: string;
      confidenceScore?: number;
    }
  ) {
    const decision = await db.decision.findUnique({
      where: { id: decisionId },
      include: { project: { include: { workspace: true } } },
    });

    if (!decision) {
      throw new NotFoundError('Decision');
    }

    // Verify access
    const hasAccess =
      decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this decision');
    }

    const updated = await db.decision.update({
      where: { id: decisionId },
      data,
      include: {
        tradeoffs: true,
        outcomes: true,
      },
    });

    return updated;
  },

  /**
   * Delete a decision
   */
  async deleteDecision(decisionId: string, userId: string) {
    const decision = await db.decision.findUnique({
      where: { id: decisionId },
      include: { project: { include: { workspace: true } } },
    });

    if (!decision) {
      throw new NotFoundError('Decision');
    }

    // Verify access
    const hasAccess =
      decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this decision');
    }

    await db.decision.delete({
      where: { id: decisionId },
    });
  },
};

export const tradeoffService = {
  /**
   * Create a tradeoff
   */
  async createTradeoff(
    decisionId: string,
    userId: string,
    optionA: string,
    optionB: string,
    reasoning: string
  ) {
    // Verify decision access
    const decision = await db.decision.findUnique({
      where: { id: decisionId },
      include: { project: { include: { workspace: true } } },
    });

    if (!decision) {
      throw new NotFoundError('Decision');
    }

    const hasAccess =
      decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this decision');
    }

    const tradeoff = await db.tradeoff.create({
      data: {
        decisionId,
        optionA,
        optionB,
        reasoning,
      },
    });

    return tradeoff;
  },

  /**
   * Get tradeoffs for a decision
   */
  async getTradeoffsForDecision(decisionId: string, userId: string) {
    const decision = await db.decision.findUnique({
      where: { id: decisionId },
      include: { project: { include: { workspace: true } } },
    });

    if (!decision) {
      throw new NotFoundError('Decision');
    }

    const hasAccess =
      decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this decision');
    }

    const tradeoffs = await db.tradeoff.findMany({
      where: { decisionId },
      orderBy: { createdAt: 'desc' },
    });

    return tradeoffs;
  },

  /**
   * Update a tradeoff
   */
  async updateTradeoff(
    tradeoffId: string,
    userId: string,
    data: {
      optionA?: string;
      optionB?: string;
      reasoning?: string;
      winner?: string;
    }
  ) {
    const tradeoff = await db.tradeoff.findUnique({
      where: { id: tradeoffId },
      include: { decision: { include: { project: { include: { workspace: true } } } } },
    });

    if (!tradeoff) {
      throw new NotFoundError('Tradeoff');
    }

    const hasAccess =
      tradeoff.decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: tradeoff.decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this tradeoff');
    }

    const updated = await db.tradeoff.update({
      where: { id: tradeoffId },
      data,
    });

    return updated;
  },

  /**
   * Delete a tradeoff
   */
  async deleteTradeoff(tradeoffId: string, userId: string) {
    const tradeoff = await db.tradeoff.findUnique({
      where: { id: tradeoffId },
      include: { decision: { include: { project: { include: { workspace: true } } } } },
    });

    if (!tradeoff) {
      throw new NotFoundError('Tradeoff');
    }

    const hasAccess =
      tradeoff.decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: tradeoff.decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this tradeoff');
    }

    await db.tradeoff.delete({
      where: { id: tradeoffId },
    });
  },
};

export const outcomeService = {
  /**
   * Create or update decision outcome
   */
  async upsertOutcome(
    decisionId: string,
    userId: string,
    data: {
      expectedOutcome?: string;
      actualOutcome?: string;
      comparison?: string;
      learningInsight?: string;
      confidenceAdjustment?: number;
    }
  ) {
    // Verify decision access
    const decision = await db.decision.findUnique({
      where: { id: decisionId },
      include: { project: { include: { workspace: true } } },
    });

    if (!decision) {
      throw new NotFoundError('Decision');
    }

    const hasAccess =
      decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this decision');
    }

    // Get or create outcome
    let outcome = await db.decisionOutcome.findFirst({
      where: { decisionId },
    });

    if (!outcome) {
      outcome = await db.decisionOutcome.create({
        data: {
          decisionId,
          ...data,
        },
      });
    } else {
      outcome = await db.decisionOutcome.update({
        where: { id: outcome.id },
        data,
      });
    }

    return outcome;
  },

  /**
   * Get outcome for a decision
   */
  async getOutcome(decisionId: string, userId: string) {
    const decision = await db.decision.findUnique({
      where: { id: decisionId },
      include: { project: { include: { workspace: true } } },
    });

    if (!decision) {
      throw new NotFoundError('Decision');
    }

    const hasAccess =
      decision.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: decision.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this decision');
    }

    const outcome = await db.decisionOutcome.findFirst({
      where: { decisionId },
    });

    return outcome || null;
  },
};
