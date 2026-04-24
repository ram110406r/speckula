import { Router, Request, Response } from 'express';
import { noteService, insightService } from '../services/thinkingService';
import { authMiddleware, asyncHandler } from '../lib/middleware';
import { sendSuccess, ValidationError } from '../lib/errors';
import {
  CreateNoteSchema,
  UpdateNoteSchema,
  CreateInsightSchema,
  GenerateInsightSchema,
} from '../lib/schemas';

const router = Router();

// ========================= 
// NOTE ROUTES
// =========================

/**
 * POST /notes/create
 * Create a new note
 */
router.post(
  '/create',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const note = await noteService.createNote(
      parsed.data.projectId,
      req.userId,
      parsed.data.title,
      parsed.data.content
    );

    sendSuccess(res, note, 201);
  })
);

/**
 * GET /notes/:projectId
 * Get all notes for a project
 */
router.get(
  '/:projectId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const notes = await noteService.getNotesForProject(req.params.projectId, req.userId);

    sendSuccess(res, notes);
  })
);

/**
 * GET /notes/id/:id
 * Get a single note
 */
router.get(
  '/id/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const note = await noteService.getNote(req.params.id, req.userId);

    sendSuccess(res, note);
  })
);

/**
 * PATCH /notes/:id
 * Update a note
 */
router.patch(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = UpdateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const note = await noteService.updateNote(req.params.id, req.userId, parsed.data);

    sendSuccess(res, note);
  })
);

/**
 * DELETE /notes/:id
 * Delete a note
 */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    await noteService.deleteNote(req.params.id, req.userId);

    sendSuccess(res, { message: 'Note deleted' });
  })
);

// ========================= 
// INSIGHT ROUTES
// =========================

/**
 * POST /insights/create
 * Create a new insight
 */
router.post(
  '/create',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateInsightSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }

    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const insight = await insightService.createInsight(
      parsed.data.projectId,
      req.userId,
      parsed.data.content,
      parsed.data.source,
      parsed.data.noteId,
      parsed.data.confidenceScore
    );

    sendSuccess(res, insight, 201);
  })
);

/**
 * GET /insights/:projectId
 * Get all insights for a project
 */
router.get(
  '/:projectId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const insights = await insightService.getInsightsForProject(req.params.projectId, req.userId);

    sendSuccess(res, insights);
  })
);

/**
 * GET /insights/note/:noteId
 * Get insights for a specific note
 */
router.get(
  '/note/:noteId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const insights = await insightService.getInsightsForNote(req.params.noteId, req.userId);

    sendSuccess(res, insights);
  })
);

/**
 * DELETE /insights/:id
 * Delete an insight
 */
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    await insightService.deleteInsight(req.params.id, req.userId);

    sendSuccess(res, { message: 'Insight deleted' });
  })
);

/**
 * PATCH /insights/:id/confidence
 * Update insight confidence score
 */
router.patch(
  '/:id/confidence',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.userId) {
      throw new Error('User ID not found in request');
    }

    const { confidenceScore } = req.body;
    if (typeof confidenceScore !== 'number' || confidenceScore < 0 || confidenceScore > 1) {
      throw new ValidationError();
    }

    const insight = await insightService.updateConfidenceScore(
      req.params.id,
      req.userId,
      confidenceScore
    );

    sendSuccess(res, insight);
  })
);

export default router;
