import { FastifyReply, FastifyRequest } from 'fastify';
import { verifyFirebaseIdToken } from './firebaseAdmin.js';

const getBearerToken = (header?: string): string | null => {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
};

const isDev = process.env.NODE_ENV !== 'production';

export const verifyFirebaseAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const authHeader = request.headers.authorization;
  const idToken = getBearerToken(authHeader);

  if (!idToken) {
    reply.code(401).send({ ok: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    request.userId = decoded.uid;
    request.firebaseToken = decoded as unknown as Record<string, unknown>;
  } catch (error) {
    // Surface Firebase Admin's real error in dev so misconfigured service
    // accounts, expired tokens, and clock skew are obvious. Production keeps
    // the generic message to avoid leaking internals.
    const adminCode = (error as { code?: string } | undefined)?.code;
    const adminMessage = error instanceof Error ? error.message : String(error);
    request.log.error(
      { err: error, firebaseAuthCode: adminCode },
      'Firebase token verification failed'
    );

    const payload: { ok: false; error: string; code?: string } = {
      ok: false,
      error: isDev ? `Unauthorized: ${adminMessage}` : 'Unauthorized',
    };
    if (isDev && adminCode) payload.code = adminCode;
    reply.code(401).send(payload);
    return;
  }
};
