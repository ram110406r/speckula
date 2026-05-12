import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import { getRedis } from './redis.js';

export const QUEUES = {
  ANALYSIS:    'analysis',
  DEAD_LETTER: 'analysis:dead-letter',
  LEARNING:    'learning',
  ROADMAP:     'roadmap',
} as const;

type QueueName = typeof QUEUES[keyof typeof QUEUES];

// Queue singletons — one Queue instance per named queue.
const queues = new Map<QueueName, Queue>();

export const getQueue = (name: QueueName): Queue => {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,   // 3s → 9s → 27s
        },
        removeOnComplete: { count: 500, age: 86400 },    // keep 500 completed, max 24 h
        removeOnFail:     { count: 200, age: 604800 },   // keep 200 failed, max 7 days
      },
    }));
  }
  return queues.get(name)!;
};

// QueueEvents emitter — subscribes to job lifecycle events for a given queue.
// Used by the WebSocket gateway to push updates to connected clients.
const queueEvents = new Map<QueueName, QueueEvents>();

export const getQueueEvents = (name: QueueName): QueueEvents => {
  if (!queueEvents.has(name)) {
    queueEvents.set(name, new QueueEvents(name, { connection: getRedis() }));
  }
  return queueEvents.get(name)!;
};

// Typed job data for analysis jobs.
export interface AnalysisJobData {
  jobId: string;        // our DB id (AnalysisJob.id)
  userId: string;
  projectId: string | null;
  workspaceId: string | null;
  content: string;
  pageType: string;
  sourceUrl: string | null;
  selectedText: string | null;
}

export interface AnalysisJobResult {
  insights: unknown[];
  competitorData: unknown | null;
  marketSignals: unknown[];
  productBrainEntries: number;
  tokensUsed: number;
}

// Helper: enqueue an analysis job and return the BullMQ job ID.
export const enqueueAnalysis = async (data: AnalysisJobData): Promise<string> => {
  const queue = getQueue(QUEUES.ANALYSIS);
  const job = await queue.add('analyze', data, {
    jobId: data.jobId,  // use our DB id as the BullMQ job id for direct lookup
  });
  return job.id!;
};

// Move a permanently failed job to the dead-letter queue for manual inspection.
// Call this from the worker's 'failed' handler on the last retry attempt.
export const moveToDeadLetter = async (data: AnalysisJobData, error: string): Promise<void> => {
  const dlq = getQueue(QUEUES.DEAD_LETTER);
  await dlq.add('failed-analysis', {
    ...data,
    failedAt: new Date().toISOString(),
    error,
  });
};

export interface LearningJobData {
  outcomeId: string;
  userId: string;
  decisionId: string;
  decisionTitle: string;
  expectedMetric: string;
  expectedValue: number;
  actualValue: number;
  deviationPct: number;
  verdict: string;
}

export interface RoadmapJobData {
  userId: string;
  workspaceId: string | null;
  quarter: string;
  decisionIds: string[];  // Firestore decision IDs to base roadmap on
  context: string;        // raw strategic context string
}

export const enqueueLearning = async (data: LearningJobData): Promise<string> => {
  const queue = getQueue(QUEUES.LEARNING);
  const job   = await queue.add('generate-insight', data, { attempts: 2, backoff: { type: 'fixed', delay: 5000 } });
  return job.id!;
};

export const enqueueRoadmap = async (data: RoadmapJobData): Promise<string> => {
  const queue = getQueue(QUEUES.ROADMAP);
  const job   = await queue.add('generate-roadmap', data, { attempts: 2, backoff: { type: 'fixed', delay: 5000 } });
  return job.id!;
};

// Close all queues gracefully.
export const closeQueues = async (): Promise<void> => {
  const all = [
    ...Array.from(queues.values()),
    ...Array.from(queueEvents.values()),
  ];
  await Promise.all(all.map((q) => q.close().catch(() => undefined)));
  queues.clear();
  queueEvents.clear();
};

export type { Job, Worker };
