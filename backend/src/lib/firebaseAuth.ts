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
    request.log.error({ error }, 'Firebase token verification failed');
    reply.code(401).send({ ok: false, error: 'Unauthorized' });
  }
};
