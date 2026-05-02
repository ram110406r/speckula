// Minimal env vars so validateEnv() passes during unit / integration tests.
// Mocks in individual test files handle the actual Firebase / DB / Groq calls.

process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.DIRECT_DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.GROQ_API_KEY ??= 'gsk_test_00000000000000000000000000000000';
process.env.FIREBASE_PROJECT_ID ??= 'test-project';
process.env.FIREBASE_CLIENT_EMAIL ??= 'test@test-project.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY ??=
  '-----BEGIN PRIVATE KEY-----\nMIItest\n-----END PRIVATE KEY-----\n';
process.env.SLACK_TOKEN_ENCRYPTION_KEY ??= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
