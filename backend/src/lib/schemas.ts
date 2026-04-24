import { z } from 'zod';

// ========================= 
// AUTH SCHEMAS
// =========================
export const SignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// ========================= 
// WORKSPACE SCHEMAS
// =========================
export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
});

// ========================= 
// PROJECT SCHEMAS
// =========================
export const CreateProjectSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
  name: z.string().min(1, 'Project name is required'),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  stage: z.enum(['Discovery', 'Validation', 'Build', 'Scale']).optional(),
});

// ========================= 
// NOTE SCHEMAS
// =========================
export const CreateNoteSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

export const UpdateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

// ========================= 
// INSIGHT SCHEMAS
// =========================
export const CreateInsightSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  noteId: z.string().uuid().optional(),
  content: z.string().min(1, 'Content is required'),
  source: z.enum(['AI', 'USER']).default('USER'),
  confidenceScore: z.number().min(0).max(1).optional(),
});

export const GenerateInsightSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  noteId: z.string().uuid('Invalid note ID'),
});

// ========================= 
// DECISION SCHEMAS
// =========================
export const CreateDecisionSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
});

export const UpdateDecisionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(['active', 'completed', 'rejected']).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
});

// ========================= 
// TRADEOFF SCHEMAS
// =========================
export const CreateTradeoffSchema = z.object({
  decisionId: z.string().uuid('Invalid decision ID'),
  optionA: z.string().min(1, 'Option A is required'),
  optionB: z.string().min(1, 'Option B is required'),
  reasoning: z.string().min(1, 'Reasoning is required'),
});

export const UpdateTradeoffSchema = z.object({
  optionA: z.string().min(1).optional(),
  optionB: z.string().min(1).optional(),
  reasoning: z.string().min(1).optional(),
  winner: z.string().optional(),
});

// ========================= 
// OUTCOME SCHEMAS
// =========================
export const CreateOutcomeSchema = z.object({
  decisionId: z.string().uuid('Invalid decision ID'),
  expectedOutcome: z.string().optional(),
  actualOutcome: z.string().optional(),
});

export const UpdateOutcomeSchema = z.object({
  expectedOutcome: z.string().optional(),
  actualOutcome: z.string().optional(),
  comparison: z.string().optional(),
  learningInsight: z.string().optional(),
  confidenceAdjustment: z.number().optional(),
});

// ========================= 
// PRD SCHEMAS
// =========================
export const CreatePRDSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

export const UpdatePRDSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

export const GeneratePRDSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
});

// ========================= 
// TASK SCHEMAS
// =========================
export const CreateTaskSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  prdId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  linkedDecisionId: z.string().uuid().optional(),
  dependsOnTaskId: z.string().uuid().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  dependsOnTaskId: z.string().uuid().optional(),
});

// ========================= 
// INTEGRATION SCHEMAS
// =========================
export const ConnectIntegrationSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  type: z.string(), // slack | jira | github | etc
  config: z.record(z.unknown()),
});

// Export types
export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type CreateInsightInput = z.infer<typeof CreateInsightSchema>;
export type CreateDecisionInput = z.infer<typeof CreateDecisionSchema>;
export type CreateTradeoffInput = z.infer<typeof CreateTradeoffSchema>;
export type CreatePRDInput = z.infer<typeof CreatePRDSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
