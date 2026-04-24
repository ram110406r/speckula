import { Router, Request, Response } from 'express';
import { workspaceService, projectService } from '../services/workspaceService';
import { authMiddleware, asyncHandler } from '../lib/middleware';
import { sendSuccess, ValidationError } from '../lib/errors';
import {
  CreateWorkspaceSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
} from '../lib/schemas';

const router = Router();

// ========================= 
// WORKSPACE ROUTES
// =========================

/**
 * POST /workspace/create
 * Create a new workspace
 */
router.post(
  '/create',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const workspace = await workspaceService.createWorkspace(req.userId, parsed.data.name);

    sendSuccess(res, workspace, 201);
  })
);

/**
 * GET /workspace/list
 * List all workspaces for the user
 */
router.get(
  '/list',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const workspaces = await workspaceService.listWorkspaces(req.userId);

    sendSuccess(res, workspaces);
  })
);

/**
 * GET /workspace/:id
 * Get a single workspace
 */
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const workspace = await workspaceService.getWorkspace(req.params.id, req.userId);

    sendSuccess(res, workspace);
  })
);

/**
 * PATCH /workspace/:id
 * Update workspace
 */
router.patch(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const workspace = await workspaceService.updateWorkspace(req.params.id, req.userId, {
      name: req.body.name,
    });

    sendSuccess(res, workspace);
  })
);

/**
 * DELETE /workspace/:id
 * Delete workspace
 */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    await workspaceService.deleteWorkspace(req.params.id, req.userId);

    sendSuccess(res, { message: 'Workspace deleted' });
  })
);

// ========================= 
// PROJECT ROUTES
// =========================

/**
 * POST /workspace/:id/project/create
 * Create a new project in workspace
 */
router.post(
  '/:id/project/create',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateProjectSchema.safeParse({
      workspaceId: req.params.id,
      ...req.body,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const project = await projectService.createProject(
      parsed.data.workspaceId,
      req.userId,
      parsed.data.name
    );

    sendSuccess(res, project, 201);
  })
);

/**
 * GET /project/:id
 * Get project details
 */
router.get(
  '/project/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const project = await projectService.getProject(req.params.id, req.userId);

    sendSuccess(res, project);
  })
);

/**
 * PATCH /project/:id
 * Update project
 */
router.patch(
  '/project/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = UpdateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const project = await projectService.updateProject(req.params.id, req.userId, parsed.data);

    sendSuccess(res, project);
  })
);

/**
 * GET /workspace/:id/projects
 * List all projects in a workspace
 */
router.get(
  '/:id/projects',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const projects = await projectService.listProjectsInWorkspace(req.params.id, req.userId);

    sendSuccess(res, projects);
  })
);

/**
 * DELETE /project/:id
 * Delete project
 */
router.delete(
  '/project/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    await projectService.deleteProject(req.params.id, req.userId);

    sendSuccess(res, { message: 'Project deleted' });
  })
);

export default router;
