// Thin wrappers around the Slack Web API. Throws on `ok: false` so callers can
// catch a single error instead of branching on response shape.

interface SlackOk<T> { ok: true; }
type SlackResponse<T> = (SlackOk<T> & T) | { ok: false; error: string };

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
  // Get both public + private channels the bot is a member of (or could join).
  const result = await slackGet<{ channels: SlackChannel[]; response_metadata?: { next_cursor?: string } }>(
    'conversations.list',
    token,
    { types: 'public_channel,private_channel', exclude_archived: 'true', limit: '200' }
  );
  return result.channels;
};

export interface SlackMessage {
  type: string;
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
  const params: Record<string, string> = {
    channel: channelId,
    limit: String(options.limit ?? 200),
  };
  if (options.oldest) params.oldest = options.oldest;
  const result = await slackGet<{ messages: SlackMessage[] }>('conversations.history', token, params);
  return result.messages;
};

// ─── Auth test (handy for verifying a token works) ─────────────────────────
export const authTest = async (token: string) => {
  return slackGet<{ user_id: string; team_id: string; team: string }>('auth.test', token);
};
