import { db } from '../lib/db';
import { NotFoundError, ForbiddenError } from '../lib/errors';

export const prdService = {
  /**
   * Create a PRD
   */
  async createPRD(
    projectId: string,
    userId: string,
    title: string,
    content: string,
    version = 1
  ) {
    const prd = await db.pRD.create({
      data: {
        projectId,
        userId,
        title,
        content,
        version,
      },
    });

    return prd;
  },

  /**
   * Get all PRDs for a project
   */
  async getPRDsForProject(projectId: string, userId: string) {
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

    const prds = await db.pRD.findMany({
      where: { projectId },
      include: { tasks: true },
      orderBy: { updatedAt: 'desc' },
    });

    return prds;
  },

  /**
   * Get a single PRD
   */
  async getPRD(prdId: string, userId: string) {
    const prd = await db.pRD.findUnique({
      where: { id: prdId },
      include: {
        project: { include: { workspace: true } },
        tasks: true,
      },
    });

    if (!prd) {
      throw new NotFoundError('PRD');
    }

    // Verify access
    const hasAccess =
      prd.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: prd.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this PRD');
    }

    return prd;
  },

  /**
   * Update a PRD
   */
  async updatePRD(
    prdId: string,
    userId: string,
    data: { title?: string; content?: string; version?: number }
  ) {
    const prd = await db.pRD.findUnique({
      where: { id: prdId },
      include: { project: { include: { workspace: true } } },
    });

    if (!prd) {
      throw new NotFoundError('PRD');
    }

    // Verify access
    const hasAccess =
      prd.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: prd.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this PRD');
    }

    const updated = await db.pRD.update({
      where: { id: prdId },
      data,
      include: { tasks: true },
    });

    return updated;
  },

  /**
   * Delete a PRD
   */
  async deletePRD(prdId: string, userId: string) {
    const prd = await db.pRD.findUnique({
      where: { id: prdId },
      include: { project: { include: { workspace: true } } },
    });

    if (!prd) {
      throw new NotFoundError('PRD');
    }

    // Verify access
    const hasAccess =
      prd.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: prd.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this PRD');
    }

    await db.pRD.delete({
      where: { id: prdId },
    });
  },
};

export const taskService = {
  /**
   * Create a task
   */
  async createTask(
    projectId: string,
    userId: string,
    title: string,
    description?: string,
    priority = 'medium',
    prdId?: string,
    linkedDecisionId?: string,
    dependsOnTaskId?: string
  ) {
    const task = await db.task.create({
      data: {
        projectId,
        userId,
        title,
        description,
        priority,
        prdId,
        linkedDecisionId,
        dependsOnTaskId,
      },
    });

    return task;
  },

  /**
   * Get all tasks for a project
   */
  async getTasksForProject(projectId: string, userId: string) {
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

    const tasks = await db.task.findMany({
      where: { projectId },
      include: {
        prd: true,
        isBlockedBy: true,
        blocks: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return tasks;
  },

  /**
   * Get a single task
   */
  async getTask(taskId: string, userId: string) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: { include: { workspace: true } },
        prd: true,
        isBlockedBy: true,
        blocks: true,
      },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    // Verify access
    const hasAccess =
      task.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: task.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this task');
    }

    return task;
  },

  /**
   * Update a task
   */
  async updateTask(
    taskId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      dependsOnTaskId?: string | null;
    }
  ) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    // Verify access
    const hasAccess =
      task.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: task.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this task');
    }

    const updated = await db.task.update({
      where: { id: taskId },
      data,
      include: {
        prd: true,
        isBlockedBy: true,
        blocks: true,
      },
    });

    return updated;
  },

  /**
   * Delete a task
   */
  async deleteTask(taskId: string, userId: string) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    // Verify access
    const hasAccess =
      task.project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: task.project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this task');
    }

    await db.task.delete({
      where: { id: taskId },
    });
  },

  /**
   * Get tasks by status
   */
  async getTasksByStatus(projectId: string, userId: string, status: string) {
    const tasks = await this.getTasksForProject(projectId, userId);
    return tasks.filter((task: { status: string }) => task.status === status);
  },

  /**
   * Get task dependencies (tasks that block this task)
   */
  async getTaskDependencies(taskId: string, userId: string) {
    const task = await this.getTask(taskId, userId);

    if (!task.isBlockedBy) {
      return [];
    }

    return [task.isBlockedBy];
  },

  /**
   * Get tasks that depend on this task
   */
  async getTaskDependents(taskId: string, userId: string) {
    const task = await this.getTask(taskId, userId);

    return task.blocks || [];
  },
};
