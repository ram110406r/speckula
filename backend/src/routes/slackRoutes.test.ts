import { createHmac } from 'crypto';
import createServer from '../app.js';

const TEST_SECRET = 'test-slack-signing-secret';

const sign = (secret: string, timestamp: string, rawBody: string) => {
  const base = `v0:${timestamp}:${rawBody}`;
  const digest = createHmac('sha256', secret).update(base).digest('hex');
  return `v0=${digest}`;
};

describe('slackRoutes', () => {
  let server: Awaited<ReturnType<typeof createServer>>;
  let originalSecret: string | undefined;

  beforeEach(async () => {
    originalSecret = process.env.SLACK_SIGNING_SECRET;
    process.env.SLACK_SIGNING_SECRET = TEST_SECRET;
    server = await createServer();
  });

  afterEach(async () => {
    await server.close();
    if (originalSecret === undefined) {
      delete process.env.SLACK_SIGNING_SECRET;
    } else {
      process.env.SLACK_SIGNING_SECRET = originalSecret;
    }
  });

  it('rejects requests with an invalid signature', async () => {
    const rawBody = JSON.stringify({ type: 'url_verification', token: 't', challenge: 'abc' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign('wrong-secret', timestamp, rawBody);

    const response = await server.inject({
      method: 'POST',
      url: '/slack/events',
      payload: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'invalid signature' });
  });

  it('responds to url_verification when the signature is valid', async () => {
    const rawBody = JSON.stringify({ type: 'url_verification', token: 't', challenge: 'abc' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign(TEST_SECRET, timestamp, rawBody);

    const response = await server.inject({
      method: 'POST',
      url: '/slack/events',
      payload: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.payload).toBe('abc');
  });
});
