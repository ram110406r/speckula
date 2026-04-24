import dotenv from 'dotenv';
import createServer from './app';
import { disconnectDb } from './lib/db';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Create Fastify server
    const fastify = await createServer();

    // Start server
    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🚀 AI Backend powered by Groq (mixtral-8x7b & llama3-70b)`);
    console.log(`📡 WebSocket ready for realtime updates`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received. Shutting down gracefully...');
  await disconnectDb();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  await disconnectDb();
  process.exit(0);
});
