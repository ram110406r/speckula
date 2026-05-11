import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getFirebaseApp } from '../lib/firebaseAdmin.js';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { db } from '../lib/db.js';

const requireUserId = (request: FastifyRequest, reply: FastifyReply): string | null => {
  const uid = request.userId;
  if (!uid) {
    reply.code(401).send({ ok: false, error: 'unauthorized' });
    return null;
  }
  return uid;
};

// Delete all documents inside a Firestore collection for a user sub-path.
// Firestore does not cascade-delete sub-collections, so each known collection
// must be listed explicitly.
async function deleteFirestoreUserData(userId: string): Promise<void> {
  const app = getFirebaseApp();
  const firestore = getFirestore(app);
  const userRef = firestore.collection('users').doc(userId);

  const subCollections = [
    'documents',
    'decisions',
    'signals',
    'notes',
    'insights',
    'prds',
    'tasks',
    'notifications',
    'integrations',
    'settings',
  ];

  // Delete sub-collection documents in batches of 500 (Firestore limit).
  await Promise.all(
    subCollections.map(async (name) => {
      const colRef = userRef.collection(name);
      let snapshot = await colRef.limit(500).get();
      while (!snapshot.empty) {
        const batch = firestore.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        snapshot = await colRef.limit(500).get();
      }
    })
  );

  // Delete the user document itself.
  await userRef.delete();
}

// Delete all PostgreSQL rows for the user across every AI table.
async function deletePgUserData(userId: string): Promise<void> {
  await Promise.all([
    db.aIInsight.deleteMany({ where: { userId } }),
    db.aIPRD.deleteMany({ where: { userId } }),
    db.aISuggestedTask.deleteMany({ where: { userId } }),
    db.decisionReasoning.deleteMany({ where: { userId } }),
    db.patternAnalysis.deleteMany({ where: { userId } }),
    db.promptLog.deleteMany({ where: { userId } }),
    db.aPIUsage.deleteMany({ where: { userId } }),
  ]);
}

export default async function userRoutes(fastify: FastifyInstance) {
  // DELETE /user/me — GDPR Article 17 "right to erasure".
  // Purges: Firestore user document + all sub-collections, all PostgreSQL AI
  // rows, Firebase Auth account. The operation is best-effort: each phase runs
  // independently so a partial Firestore failure does not prevent the Postgres
  // purge, and vice versa.
  fastify.delete('/me', async (request, reply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const errors: string[] = [];

    // Phase 1: Firestore
    await deleteFirestoreUserData(userId).catch((err) => {
      fastify.log.error({ err, userId }, 'user deletion: firestore phase failed');
      errors.push('firestore');
    });

    // Phase 2: PostgreSQL
    await deletePgUserData(userId).catch((err) => {
      fastify.log.error({ err, userId }, 'user deletion: postgres phase failed');
      errors.push('postgres');
    });

    // Phase 3: Firebase Auth — do last so the user can still authenticate
    // during the earlier phases if they retry a partially-failed deletion.
    await getAuth(getFirebaseApp()).deleteUser(userId).catch((err) => {
      fastify.log.error({ err, userId }, 'user deletion: firebase auth phase failed');
      errors.push('auth');
    });

    if (errors.length > 0) {
      reply.code(207).send({
        ok: false,
        error: 'Partial deletion — some data could not be removed. Contact support.',
        failedPhases: errors,
      });
      return;
    }

    reply.code(200).send({ ok: true, message: 'Account and all associated data deleted.' });
  });

  // GET /user/me/export — GDPR Article 20 "right to data portability".
  // Returns all AI-generated data for the authenticated user as JSON.
  // Firestore data (notes, decisions, etc.) lives client-side; only the AI
  // layer (insights, PRDs, tasks, decisions, usage logs) is stored server-side.
  fastify.get('/me/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireUserId(request, reply);
    if (!userId) return;

    try {
      const [insights, prds, tasks, reasoning, patterns, usage, promptLogs] = await Promise.all([
        db.aIInsight.findMany({ where: { userId }, orderBy: { generatedAt: 'desc' } }),
        db.aIPRD.findMany({ where: { userId }, orderBy: { generatedAt: 'desc' } }),
        db.aISuggestedTask.findMany({ where: { userId }, orderBy: { generatedAt: 'desc' } }),
        db.decisionReasoning.findMany({ where: { userId }, orderBy: { generatedAt: 'desc' } }),
        db.patternAnalysis.findMany({ where: { userId }, orderBy: { analyzedAt: 'desc' } }),
        db.aPIUsage.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
        db.promptLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 1000,
          // Exclude the raw prompt text from the export to avoid exporting
          // other users' data that may have been referenced in a prompt.
          select: {
            id: true, projectId: true, modelUsed: true, inputTokens: true,
            outputTokens: true, totalTokens: true, executionMs: true, cost: true,
            cachedResult: true, promptId: true, promptVersion: true, createdAt: true,
          },
        }),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        userId,
        aiInsights: insights,
        aiPRDs: prds,
        aiSuggestedTasks: tasks,
        decisionReasoning: reasoning,
        patternAnalyses: patterns,
        apiUsage: usage,
        promptLogs,
      };

      reply
        .header('Content-Type', 'application/json')
        .header('Content-Disposition', `attachment; filename="speckula-export-${userId}.json"`)
        .code(200)
        .send(payload);
    } catch (err) {
      fastify.log.error({ err, userId }, 'user export failed');
      reply.code(500).send({ ok: false, error: 'Failed to export data' });
    }
  });
}
