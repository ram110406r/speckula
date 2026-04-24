import { Router, Request, Response } from 'express';
import { aiEngineService } from '../services/aiEngineService';
import { authMiddleware, asyncHandler } from '../lib/middleware';
import { sendSuccess, ValidationError } from '../lib/errors';
import { GenerateInsightSchema, GeneratePRDSchema } from '../lib/schemas';

const router = Router();

/**
 * POST /ai/insights/generate
 * Trigger AI insight generation for a note
 */
router.post(
  '/insights/generate',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = GenerateInsightSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const result = await aiEngineService.triggerInsightGeneration(
      parsed.data.projectId,
      req.userId,
      parsed.data.noteId
    );

    sendSuccess(res, result);
  })
);

/**
 * POST /ai/prd/generate
 * Trigger AI PRD generation
 */
router.post(
  '/prd/generate',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = GeneratePRDSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const result = await aiEngineService.generatePRD(
      parsed.data.projectId,
      req.userId,
      parsed.data.title,
      parsed.data.description
    );

    sendSuccess(res, result);
  })
);

/**
 * POST /ai/tasks/suggest
 * Get AI suggestions for tasks
 */
router.post(
  '/tasks/suggest',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, prdId } = req.body;

    if (!projectId || !prdId) {
      throw new ValidationError({
        errors: [
          { message: 'projectId and prdId are required', path: ['body'] },
        ],
      } as any);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const result = await aiEngineService.suggestTasks(projectId, req.userId, prdId);

    sendSuccess(res, result);
  })
);

/**
 * POST /ai/analyze/patterns
 * Analyze patterns in text content
 */
router.post(
  '/analyze/patterns',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, content } = req.body;

    if (!projectId || !content) {
      throw new ValidationError({
        errors: [
          { message: 'projectId and content are required', path: ['body'] },
        ],
      } as any);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const result = await aiEngineService.analyzePatterns(
      projectId,
      req.userId,
      content
    );

    sendSuccess(res, result);
  })
);

export default router;
