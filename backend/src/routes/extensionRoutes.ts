import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { enqueueAnalysis } from '../lib/queue.js';
import { publishEvent } from '../services/eventBus.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) { reply.code(401).send({ ok: false, error: 'unauthorized' }); return null; }
  return uid;
};

const heartbeatSchema = z.object({
  extensionVersion: z.string().min(1).max(20),
  browserType:      z.string().min(1).max(30),
  workspaceId:      z.string().optional(),
  metadata:         z.record(z.string(), z.unknown()).optional(),
}).strict();

const analyzeSchema = z.object({
  content:      z.string().min(10).max(100_000),
  pageType:     z.string().min(1).max(50),
  sourceUrl:    z.string().url().optional(),
  selectedText: z.string().max(5_000).optional(),
  projectId:    z.string().optional(),
  workspaceId:  z.string().optional(),
}).strict();

export default async function extensionRoutes(fastify: FastifyInstance) {

  // POST /extension/heartbeat
  // Extension sends this every 30–60 seconds to confirm it is alive.
  fastify.post('/heartbeat', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const body = heartbeatSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'Invalid payload' });
      return;
    }
    const { extensionVersion, browserType, workspaceId, metadata } = body.data;

    // Upsert the session — one row per (userId, browserType).
    await db.extensionSession.upsert({
      where: { userId_browserType: { userId, browserType } },
      create: { userId, extensionVersion, browserType, workspaceId, metadata: metadata ? JSON.stringify(metadata) : undefined },
      update: { extensionVersion, lastSeenAt: new Date(), workspaceId, metadata: metadata ? JSON.stringify(metadata) : undefined },
    }).catch(() => undefined);

    // Log raw heartbeat (retention sweeper removes old rows).
    db.extensionHeartbeat.create({
      data: { userId, extensionVersion, browserType, workspaceId },
    }).catch(() => undefined);

    reply.code(200).send({ ok: true, serverTime: new Date().toISOString() });
  });

  // GET /extension/status
  // Returns the current connection state for the authenticated user.
  fastify.get('/status', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const session = await db.extensionSession.findFirst({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (!session) {
      reply.code(200).send({ ok: true, data: { status: 'not_installed', session: null } });
      return;
    }

    const msSinceHeartbeat = Date.now() - session.lastSeenAt.getTime();
    const status =
      msSinceHeartbeat < 90_000  ? 'connected'     :  // < 90s → fresh heartbeat
      msSinceHeartbeat < 300_000 ? 'reconnecting'  :  // < 5min → grace period
                                   'disconnected';

    reply.code(200).send({
      ok: true,
      data: {
        status,
        extensionVersion: session.extensionVersion,
        browserType:      session.browserType,
        lastSeenAt:       session.lastSeenAt.toISOString(),
        workspaceId:      session.workspaceId,
        msSinceHeartbeat,
      },
    });
  });

  // POST /extension/analyze
  // Enqueues an async analysis job and returns a jobId immediately (202).
  fastify.post('/analyze', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const body = analyzeSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400).send({ ok: false, error: 'Invalid payload' });
      return;
    }
    const { content, pageType, sourceUrl, selectedText, projectId, workspaceId } = body.data;

    // Create a DB job record first so the client can poll status.
    const job = await db.analysisJob.create({
      data: {
        userId,
        projectId: projectId ?? null,
        pageType,
        sourceUrl: sourceUrl ?? null,
        inputContent: content.slice(0, 50_000),
        status: 'queued',
      },
    });

    // Enqueue the BullMQ job using the DB id as the BullMQ job id.
    await enqueueAnalysis({
      jobId:        job.id,
      userId,
      projectId:    projectId ?? null,
      content,
      pageType,
      sourceUrl:    sourceUrl ?? null,
      selectedText: selectedText ?? null,
    });

    // Log activity.
    db.activityLog.create({
      data: {
        userId,
        action:       'job.enqueue',
        resourceType: 'AnalysisJob',
        resourceId:   job.id,
        metadata:     JSON.stringify({ pageType, sourceUrl }),
        ipAddress:    request.ip,
        userAgent:    request.headers['user-agent'] ?? null,
      },
    }).catch(() => undefined);

    reply.code(202).send({ ok: true, jobId: job.id, status: 'queued' });
  });

  // GET /extension/jobs/:jobId
  // Poll for job status. Extension polls this every ~2.5 s.
  fastify.get<{ Params: { jobId: string } }>('/jobs/:jobId', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const { jobId } = request.params;
    const job = await db.analysisJob.findUnique({ where: { id: jobId } });

    if (!job || job.userId !== userId) {
      reply.code(404).send({ ok: false, error: 'Job not found' });
      return;
    }

    const result = job.result ? JSON.parse(job.result) : null;
    reply.code(200).send({
      ok: true,
      data: {
        jobId:       job.id,
        status:      job.status,
        progress:    job.progress,
        pageType:    job.pageType,
        sourceUrl:   job.sourceUrl,
        result,
        error:       job.error,
        createdAt:   job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
      },
    });
  });

  // GET /extension/jobs
  // Recent jobs for the authenticated user (last 50).
  fastify.get('/jobs', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const jobs = await db.analysisJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, status: true, progress: true, pageType: true,
        sourceUrl: true, createdAt: true, completedAt: true, error: true,
      },
    });

    reply.code(200).send({ ok: true, data: jobs });
  });

  // GET /extension/stats
  // Aggregate extension usage stats for the authenticated user.
  fastify.get('/stats', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, completed, failed, recentJobs, session] = await Promise.all([
      db.analysisJob.count({ where: { userId } }),
      db.analysisJob.count({ where: { userId, status: 'completed' } }),
      db.analysisJob.count({ where: { userId, status: 'failed' } }),
      db.analysisJob.count({ where: { userId, createdAt: { gte: since7d } } }),
      db.extensionSession.findFirst({ where: { userId }, orderBy: { lastSeenAt: 'desc' } }),
    ]);

    reply.code(200).send({
      ok: true,
      data: {
        totalJobs:    total,
        completedJobs: completed,
        failedJobs:   failed,
        jobsLast7Days: recentJobs,
        lastSeen:     session?.lastSeenAt?.toISOString() ?? null,
        extensionVersion: session?.extensionVersion ?? null,
      },
    });
  });

  // POST /extension/disconnect
  // Explicitly disconnect the extension session (user sign-out from extension).
  fastify.post('/disconnect', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    await db.extensionSession.deleteMany({ where: { userId } }).catch(() => undefined);

    publishEvent({ type: 'extension.disconnected', userId, data: {} }).catch(() => undefined);

    reply.code(200).send({ ok: true });
  });
}
