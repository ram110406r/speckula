// Maps Prisma client errors to HTTP status codes.
// Import this alongside classify() in any route file.

interface PrismaClientKnownError {
  code: string;
  meta?: Record<string, unknown>;
}

const isPrismaError = (err: unknown): err is PrismaClientKnownError =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  typeof (err as Record<string, unknown>).code === 'string';

export const classifyPrismaError = (
  err: unknown
): { status: number; message: string } | null => {
  if (!isPrismaError(err)) return null;
  switch (err.code) {
    case 'P2002':
      return { status: 409, message: 'A record with that value already exists.' };
    case 'P2025':
      return { status: 404, message: 'Record not found.' };
    case 'P2003':
      return { status: 409, message: 'Related record not found.' };
    case 'P2024':
      return { status: 503, message: 'Database connection pool timeout. Try again.' };
    default:
      return null;
  }
};
