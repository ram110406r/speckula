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
    // Unique constraint violation — duplicate key
    case 'P2002':
      return { status: 409, message: 'A record with that value already exists.' };
    // Record not found
    case 'P2025':
      return { status: 404, message: 'Record not found.' };
    // Foreign key constraint failed
    case 'P2003':
      return { status: 409, message: 'Related record not found.' };
    // Pool timeout / connection exhaustion
    case 'P2024':
      return { status: 503, message: 'Database connection pool timeout. Try again.' };
    // Field value too long for column type
    case 'P2005':
      return { status: 400, message: 'Field value is too long for the database column.' };
    // Query parsing failed
    case 'P2009':
      return { status: 400, message: 'Invalid query syntax.' };
    // Raw query failed
    case 'P2010':
      return { status: 500, message: 'Raw query failed. Check query syntax.' };
    // NOT NULL constraint violation
    case 'P2011':
      return { status: 400, message: 'Required field is missing.' };
    // Transaction conflict
    case 'P2034':
      return { status: 409, message: 'Transaction conflict. Retry your request.' };
    // Relation violation
    case 'P2014':
      return { status: 409, message: 'Required relation field missing.' };
    // Database connection failed
    case 'P2019':
      return { status: 503, message: 'Database connection failed. Try again.' };
    default:
      return null; // Unmapped errors treated as 500 by caller
  }
};
