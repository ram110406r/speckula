// Weekly digest emailer. Run on a cron (e.g. every Monday at 08:00 UTC):
//
//   npm run digest:send
//
// Requires RESEND_API_KEY and RESEND_FROM_EMAIL in the environment.
// If either is missing the script exits gracefully (0) — safe to deploy
// before email is fully configured.

import { getFirebaseApp } from '../lib/firebaseAdmin.js';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { db } from '../lib/db.js';

interface WeeklyStats {
  userId: string;
  email: string;
  displayName: string;
  aiRequests: number;
  tokensUsed: number;
  estimatedCostUsd: number;
}

// Collect the last 7 days of AI usage from PostgreSQL for a single user.
async function getWeeklyAiStats(userId: string): Promise<{ requests: number; tokens: number; cost: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.aPIUsage.findMany({
    where: { userId, date: { gte: since } },
    select: { totalRequests: true, totalTokens: true, totalCost: true },
  });
  return rows.reduce(
    (acc, r) => ({
      requests: acc.requests + r.totalRequests,
      tokens: acc.tokens + r.totalTokens,
      cost: acc.cost + r.totalCost,
    }),
    { requests: 0, tokens: 0, cost: 0 }
  );
}

// Collect Firestore counts for a single user (documents, decisions, signals).
async function getFirestoreCounts(userId: string): Promise<{ documents: number; decisions: number }> {
  const app = getFirebaseApp();
  const firestore = getFirestore(app);
  try {
    const [docsSnap, decisionsSnap] = await Promise.all([
      firestore.collection('users').doc(userId).collection('documents').count().get(),
      firestore.collection('users').doc(userId).collection('decisions').count().get(),
    ]);
    return {
      documents: docsSnap.data().count,
      decisions: decisionsSnap.data().count,
    };
  } catch {
    return { documents: 0, decisions: 0 };
  }
}

function buildEmailHtml(stats: WeeklyStats & { documents: number; decisions: number }): string {
  const name = stats.displayName || stats.email.split('@')[0];
  const costStr = stats.estimatedCostUsd < 0.01
    ? '<$0.01'
    : `$${stats.estimatedCostUsd.toFixed(2)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your SPECKULA weekly digest</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="padding:24px 28px;border-bottom:1px solid #f3f4f6;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#6366f1;letter-spacing:.05em;text-transform:uppercase;">SPECKULA</p>
      <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#111827;">Your week in product</h1>
      <p style="margin:0;font-size:13px;color:#6b7280;">Hi ${name} — here's what happened in the last 7 days.</p>
    </div>

    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#374151;font-weight:500;">AI requests</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <span style="font-size:13px;color:#111827;font-weight:700;">${stats.aiRequests.toLocaleString()}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#374151;font-weight:500;">Tokens used</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <span style="font-size:13px;color:#111827;font-weight:700;">${stats.tokensUsed.toLocaleString()}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#374151;font-weight:500;">Estimated AI cost</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <span style="font-size:13px;color:#111827;font-weight:700;">${costStr}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#374151;font-weight:500;">Documents</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <span style="font-size:13px;color:#111827;font-weight:700;">${stats.documents}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;">
            <span style="font-size:13px;color:#374151;font-weight:500;">Decisions</span>
          </td>
          <td style="padding:10px 0;text-align:right;">
            <span style="font-size:13px;color:#111827;font-weight:700;">${stats.decisions}</span>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:0 28px 24px;">
      <a href="https://speckula.eddgeportal.com"
         style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
        Open SPECKULA →
      </a>
    </div>

    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;background:#f9fafb;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">
        You're receiving this because you have a SPECKULA account.
        This email was sent to ${stats.email}.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendDigestEmail(
  resend: { emails: { send: (opts: Record<string, unknown>) => Promise<{ error: unknown }> } },
  fromEmail: string,
  stats: WeeklyStats & { documents: number; decisions: number }
): Promise<void> {
  const html = buildEmailHtml(stats);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: stats.email,
    subject: `Your SPECKULA weekly digest — ${stats.aiRequests} AI requests this week`,
    html,
  });
  if (error) {
    console.error(`[digest] Failed to send to ${stats.email}:`, error);
  } else {
    console.log(`[digest] Sent to ${stats.email} (${stats.aiRequests} requests)`);
  }
}

export async function sendWeeklyDigest(): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'SPECKULA <digest@speckula.io>';

  if (!apiKey) {
    console.log('[digest] RESEND_API_KEY not set — skipping digest send.');
    return;
  }

  // Dynamic import to avoid breaking the build when resend is not installed.
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const app = getFirebaseApp();
  const auth = getAuth(app);

  let sent = 0;
  let skipped = 0;
  let pageToken: string | undefined;

  // Page through all Firebase Auth users in batches of 1000.
  do {
    const listResult = await auth.listUsers(1000, pageToken);
    pageToken = listResult.pageToken;

    // Process users in parallel batches of 20 to avoid overwhelming Resend or
    // Firestore with thousands of simultaneous requests.
    const BATCH = 20;
    for (let i = 0; i < listResult.users.length; i += BATCH) {
      const chunk = listResult.users.slice(i, i + BATCH);
      await Promise.all(
        chunk.map(async (user) => {
          if (!user.email || user.disabled) { skipped += 1; return; }

          const [aiStats, firestoreCounts] = await Promise.all([
            getWeeklyAiStats(user.uid),
            getFirestoreCounts(user.uid),
          ]);

          // Skip users with zero activity to reduce email noise.
          if (aiStats.requests === 0 && firestoreCounts.documents === 0) {
            skipped += 1;
            return;
          }

          await sendDigestEmail(resend as Parameters<typeof sendDigestEmail>[0], fromEmail, {
            userId: user.uid,
            email: user.email!,
            displayName: user.displayName || '',
            aiRequests: aiStats.requests,
            tokensUsed: aiStats.tokens,
            estimatedCostUsd: aiStats.cost,
            documents: firestoreCounts.documents,
            decisions: firestoreCounts.decisions,
          });
          sent += 1;
        })
      );
    }
  } while (pageToken);

  console.log(`[digest] Done. sent=${sent} skipped=${skipped}`);
}

// Standalone script entry point — used by `npm run digest:send`.
const _isMain = process.argv[1] && /weeklyDigest\.[jt]s$/.test(process.argv[1]);
if (_isMain) {
  sendWeeklyDigest()
    .catch((err) => {
      console.error('[digest] failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
