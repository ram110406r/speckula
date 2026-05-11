import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import { getRedis } from './redis.js';

export const QUEUES = {
  ANALYSIS: 'analysis',
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
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
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
