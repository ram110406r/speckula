// Thin wrappers around the Slack Web API. Throws on `ok: false` so callers can
// catch a single error instead of branching on response shape.

interface SlackOk { ok: true; }
type SlackResponse<T> = (SlackOk & T) | { ok: false; error: string };

const SLACK_API = 'https://slack.com/api';

const slackPostForm = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`${SLACK_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json()) as SlackResponse<T>;
  if (!json.ok) throw new Error(`slack ${path} failed: ${(json as { error: string }).error}`);
  return json as T;
};

const slackGet = async <T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> => {
  const url = new URL(`${SLACK_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as SlackResponse<T>;
  if (!json.ok) throw new Error(`slack ${path} failed: ${(json as { error: string }).error}`);
  return json as T;
};

// ─── OAuth ─────────────────────────────────────────────────────────────────
export interface SlackOAuthAccess {
  ok: true;
  access_token: string;
  bot_user_id: string;
  scope: string;
  team: { id: string; name: string };
  authed_user: { id: string };
}

export const exchangeOAuthCode = async (params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<SlackOAuthAccess> => {
  return slackPostForm<SlackOAuthAccess>('oauth.v2.access', {
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
  });
};

// ─── Conversations ─────────────────────────────────────────────────────────
export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  is_archived: boolean;
  num_members?: number;
}

export const listChannels = async (token: string): Promise<SlackChannel[]> => {
  const all: SlackChannel[] = [];
  let cursor: string | undefined;
  do {
    const result = await slackGet<{ channels: SlackChannel[]; response_metadata?: { next_cursor?: string } }>(
      'conversations.list',
      token,
      {
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '200',
        ...(cursor ? { cursor } : {}),
      }
    );
    all.push(...result.channels);
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return all;
};

export interface SlackMessage {
  type: string;
  subtype?: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  channel?: string;
}

export const fetchChannelHistory = async (
  token: string,
  channelId: string,
  options: { limit?: number; oldest?: string } = {}
): Promise<SlackMessage[]> => {
  const all: SlackMessage[] = [];
  const cap = options.limit ?? 200;
  let cursor: string | undefined;
  do {
    const batchSize = Math.min(200, cap - all.length);
    const params: Record<string, string> = { channel: channelId, limit: String(batchSize) };
    if (options.oldest) params.oldest = options.oldest;
    if (cursor) params.cursor = cursor;
    const result = await slackGet<{ messages: SlackMessage[]; response_metadata?: { next_cursor?: string } }>(
      'conversations.history', token, params
    );
    all.push(...result.messages);
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor && all.length < cap);
  return all;
};

// ─── Auth test (handy for verifying a token works) ─────────────────────────
export const authTest = async (token: string) => {
  return slackGet<{ user_id: string; team_id: string; team: string }>('auth.test', token);
};
