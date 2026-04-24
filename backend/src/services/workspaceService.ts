import { db } from '../lib/db';
import { NotFoundError, ForbiddenError } from '../lib/errors';

export const workspaceService = {
  /**
   * Create a new workspace
   */
  async createWorkspace(userId: string, name: string) {
    const workspace = await db.workspace.create({
      data: {
        name,
        ownerId: userId,
      },
    });

    return workspace;
  },

  /**
   * List all workspaces for a user (owned + member)
   */
  async listWorkspaces(userId: string) {
    const workspaces = await db.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        _count: {
          select: { members: true, projects: true },
        },
      },
    });

    return workspaces;
  },

  /**
   * Get a single workspace
   */
  async getWorkspace(workspaceId: string, userId: string) {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: true,
        projects: {
          select: {
            id: true,
            name: true,
            stage: true,
            createdAt: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    // Check if user has access
    const hasAccess =
      workspace.ownerId === userId ||
      workspace.members.some((member: { userId: string }) => member.userId === userId);

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this workspace');
    }

    return workspace;
  },

  /**
   * Update workspace
   */
  async updateWorkspace(workspaceId: string, userId: string, data: { name?: string }) {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenError('Only workspace owner can update it');
    }

    const updated = await db.workspace.update({
      where: { id: workspaceId },
      data,
    });

    return updated;
  },

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string, userId: string) {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenError('Only workspace owner can delete it');
    }

    await db.workspace.delete({
      where: { id: workspaceId },
    });
  },

  /**
   * Add member to workspace
   */
  async addMember(workspaceId: string, userId: string, memberId: string, role = 'member') {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenError('Only workspace owner can add members');
    }

    const member = await db.workspaceMember.create({
      data: {
        workspaceId,
        userId: memberId,
        role,
      },
    });

    return member;
  },

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId: string, userId: string, memberId: string) {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenError('Only workspace owner can remove members');
    }

    await db.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberId,
        },
      },
    });
  },
};

export const projectService = {
  /**
   * Create a new project
   */
  async createProject(
    workspaceId: string,
    userId: string,
    name: string,
    stage = 'Discovery'
  ) {
    // Verify workspace access
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    const hasAccess =
      workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this workspace');
    }

    const project = await db.project.create({
      data: {
        workspaceId,
        name,
        stage,
      },
    });

    return project;
  },

  /**
   * Get project
   */
  async getProject(projectId: string, userId: string) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: true,
        _count: {
          select: {
            notes: true,
            insights: true,
            decisions: true,
            prds: true,
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Verify access
    const workspace = project.workspace;
    const hasAccess =
      workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this project');
    }

    return project;
  },

  /**
   * Update project
   */
  async updateProject(projectId: string, userId: string, data: { name?: string; stage?: string }) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    // Verify access
    const hasAccess =
      project.workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId: project.workspace.id, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this project');
    }

    const updated = await db.project.update({
      where: { id: projectId },
      data,
    });

    return updated;
  },

  /**
   * List projects in workspace
   */
  async listProjectsInWorkspace(workspaceId: string, userId: string) {
    // Verify workspace access
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    const hasAccess =
      workspace.ownerId === userId ||
      (await db.workspaceMember.findFirst({
        where: { workspaceId, userId },
      })) !== null;

    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this workspace');
    }

    const projects = await db.project.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: {
            notes: true,
            insights: true,
            decisions: true,
            prds: true,
            tasks: true,
          },
        },
      },
    });

    return projects;
  },

  /**
   * Delete project
   */
  async deleteProject(projectId: string, userId: string) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    if (project.workspace.ownerId !== userId) {
      throw new ForbiddenError('Only workspace owner can delete projects');
    }

    await db.project.delete({
      where: { id: projectId },
    });
  },
};
