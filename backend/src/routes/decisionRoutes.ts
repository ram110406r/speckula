import { Router, Request, Response } from 'express';
import {
  decisionService,
  tradeoffService,
  outcomeService,
} from '../services/decisionService';
import { authMiddleware, asyncHandler } from '../lib/middleware';
import { sendSuccess, ValidationError } from '../lib/errors';
import {
  CreateDecisionSchema,
  UpdateDecisionSchema,
  CreateTradeoffSchema,
  UpdateTradeoffSchema,
  UpdateOutcomeSchema,
} from '../lib/schemas';

const router = Router();

// ========================= 
// DECISION ROUTES
// =========================

/**
 * POST /decision/create
 * Create a new decision
 */
router.post(
  '/create',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const decision = await decisionService.createDecision(
      parsed.data.projectId,
      req.userId,
      parsed.data.title,
      parsed.data.description
    );

    sendSuccess(res, decision, 201);
  })
);

/**
 * GET /decision/:projectId
 * Get all decisions for a project
 */
router.get(
  '/:projectId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const decisions = await decisionService.getDecisionsForProject(
      req.params.projectId,
      req.userId
    );

    sendSuccess(res, decisions);
  })
);

/**
 * GET /decision/id/:id
 * Get a single decision
 */
router.get(
  '/id/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const decision = await decisionService.getDecision(req.params.id, req.userId);

    sendSuccess(res, decision);
  })
);

/**
 * PATCH /decision/:id
 * Update a decision
 */
router.patch(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = UpdateDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const decision = await decisionService.updateDecision(req.params.id, req.userId, parsed.data);

    sendSuccess(res, decision);
  })
);

/**
 * DELETE /decision/:id
 * Delete a decision
 */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    await decisionService.deleteDecision(req.params.id, req.userId);

    sendSuccess(res, { message: 'Decision deleted' });
  })
);

// ========================= 
// TRADEOFF ROUTES
// =========================

/**
 * POST /tradeoff/create
 * Create a new tradeoff
 */
router.post(
  '/tradeoff/create',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateTradeoffSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const tradeoff = await tradeoffService.createTradeoff(
      parsed.data.decisionId,
      req.userId,
      parsed.data.optionA,
      parsed.data.optionB,
      parsed.data.reasoning
    );

    sendSuccess(res, tradeoff, 201);
  })
);

/**
 * GET /tradeoff/:decisionId
 * Get tradeoffs for a decision
 */
router.get(
  '/tradeoff/:decisionId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const tradeoffs = await tradeoffService.getTradeoffsForDecision(
      req.params.decisionId,
      req.userId
    );

    sendSuccess(res, tradeoffs);
  })
);

/**
 * PATCH /tradeoff/:id
 * Update a tradeoff
 */
router.patch(
  '/tradeoff/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = UpdateTradeoffSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const tradeoff = await tradeoffService.updateTradeoff(
      req.params.id,
      req.userId,
      parsed.data
    );

    sendSuccess(res, tradeoff);
  })
);

/**
 * DELETE /tradeoff/:id
 * Delete a tradeoff
 */
router.delete(
  '/tradeoff/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    await tradeoffService.deleteTradeoff(req.params.id, req.userId);

    sendSuccess(res, { message: 'Tradeoff deleted' });
  })
);

// ========================= 
// OUTCOME ROUTES
// =========================

/**
 * POST /decision/:id/outcome
 * Create or update decision outcome
 */
router.post(
  '/:id/outcome',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = UpdateOutcomeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const outcome = await outcomeService.upsertOutcome(
      req.params.id,
      req.userId,
      parsed.data
    );

    sendSuccess(res, outcome, 201);
  })
);

/**
 * GET /decision/:id/outcome
 * Get outcome for a decision
 */
router.get(
  '/:id/outcome',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const outcome = await outcomeService.getOutcome(req.params.id, req.userId);

    sendSuccess(res, outcome);
  })
);

export default router;
