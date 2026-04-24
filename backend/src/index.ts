import http from 'http';
import dotenv from 'dotenv';
import createApp from './app';
import { RealtimeServer } from './lib/realtime';
import { disconnectDb } from './lib/db';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Create Express app
    const app = createApp();

    // Create HTTP server
    const server = http.createServer(app);

    // Setup WebSocket realtime server
    const realtimeServer = new RealtimeServer(server);

    // Start server
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server on ws://localhost:${PORT}/ws`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        console.log('HTTP server closed');
        realtimeServer.close();
        await disconnectDb();
        console.log('Database disconnected');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
