import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    firebaseToken?: Record<string, unknown>;
  }
}
