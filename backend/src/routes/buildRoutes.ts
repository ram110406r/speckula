import { Router, Request, Response } from 'express';
import { prdService, taskService } from '../services/buildService';
import { authMiddleware, asyncHandler } from '../lib/middleware';
import { sendSuccess, ValidationError } from '../lib/errors';
import {
  CreatePRDSchema,
  UpdatePRDSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
} from '../lib/schemas';

const router = Router();

// ========================= 
// PRD ROUTES
// =========================

/**
 * POST /prd/create
 * Create a new PRD
 */
router.post(
  '/create',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreatePRDSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const prd = await prdService.createPRD(
      parsed.data.projectId,
      req.userId,
      parsed.data.title,
      parsed.data.content
    );

    sendSuccess(res, prd, 201);
  })
);

/**
 * GET /prd/:projectId
 * Get all PRDs for a project
 */
router.get(
  '/:projectId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const prds = await prdService.getPRDsForProject(req.params.projectId, req.userId);

    sendSuccess(res, prds);
  })
);

/**
 * GET /prd/id/:id
 * Get a single PRD
 */
router.get(
  '/id/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const prd = await prdService.getPRD(req.params.id, req.userId);

    sendSuccess(res, prd);
  })
);

/**
 * PATCH /prd/:id
 * Update a PRD
 */
router.patch(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = UpdatePRDSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const prd = await prdService.updatePRD(req.params.id, req.userId, parsed.data);

    sendSuccess(res, prd);
  })
);

/**
 * DELETE /prd/:id
 * Delete a PRD
 */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    await prdService.deletePRD(req.params.id, req.userId);

    sendSuccess(res, { message: 'PRD deleted' });
  })
);

// ========================= 
// TASK ROUTES
// =========================

/**
 * POST /task/create
 * Create a new task
 */
router.post(
  '/task/create',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const task = await taskService.createTask(
      parsed.data.projectId,
      req.userId,
      parsed.data.title,
      parsed.data.description,
      parsed.data.priority,
      parsed.data.prdId,
      parsed.data.linkedDecisionId,
      parsed.data.dependsOnTaskId
    );

    sendSuccess(res, task, 201);
  })
);

/**
 * GET /task/:projectId
 * Get all tasks for a project
 */
router.get(
  '/project/:projectId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const tasks = await taskService.getTasksForProject(req.params.projectId, req.userId);

    sendSuccess(res, tasks);
  })
);

/**
 * GET /task/id/:id
 * Get a single task
 */
router.get(
  '/id/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const task = await taskService.getTask(req.params.id, req.userId);

    sendSuccess(res, task);
  })
);

/**
 * PATCH /task/:id
 * Update a task
 */
router.patch(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = UpdateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const task = await taskService.updateTask(req.params.id, req.userId, parsed.data);

    sendSuccess(res, task);
  })
);

/**
 * DELETE /task/:id
 * Delete a task
 */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    await taskService.deleteTask(req.params.id, req.userId);

    sendSuccess(res, { message: 'Task deleted' });
  })
);

/**
 * GET /task/:projectId/status/:status
 * Get tasks by status
 */
router.get(
  '/:projectId/status/:status',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const tasks = await taskService.getTasksByStatus(
      req.params.projectId,
      req.userId,
      req.params.status
    );

    sendSuccess(res, tasks);
  })
);

/**
 * GET /task/:id/dependencies
 * Get task dependencies
 */
router.get(
  '/:id/dependencies',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const dependencies = await taskService.getTaskDependencies(req.params.id, req.userId);

    sendSuccess(res, dependencies);
  })
);

export default router;
