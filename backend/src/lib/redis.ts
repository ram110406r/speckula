import Redis from 'ioredis';

let _redis: Redis | null = null;
let _subscriber: Redis | null = null;

const makeClient = (url: string): Redis => {
  const client = new Redis(url, {
    maxRetriesPerRequest: null,  // BullMQ requires null
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });

  client.on('connect', () => {
    console.log('[redis] connected');
  });

  return client;
};

// Main Redis client — used for BullMQ queues and general key-value ops.
export const getRedis = (): Redis => {
  if (!_redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    _redis = makeClient(url);
  }
  return _redis;
};

// Dedicated subscriber client — a Redis connection in subscribe mode cannot
// issue commands, so pub/sub requires its own connection.
export const getRedisSubscriber = (): Redis => {
  if (!_subscriber) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    _subscriber = makeClient(url);
  }
  return _subscriber;
};

// Graceful shutdown — call from process exit handlers.
export const disconnectRedis = async (): Promise<void> => {
  const clients = [_redis, _subscriber].filter(Boolean) as Redis[];
  await Promise.all(clients.map((c) => c.quit().catch(() => undefined)));
  _redis = null;
  _subscriber = null;
};
