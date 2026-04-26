"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Hash,
  Loader2,
  MessageSquare,
  Plug,
  Plug2,
  Check,
  Lock,
  Download,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  subscribeToSlackMessages,
  subscribeToSlackWorkspaces,
  type SlackMessage,
  type SlackWorkspace,
} from "@/lib/firebase/db";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  is_archived: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function formatRelativeTime(slackTs: string): string {
  const seconds = parseFloat(slackTs);
  if (!Number.isFinite(seconds)) return "";
  const diffMs = Date.now() - seconds * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

export function SlackView() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Subscribe to user's connected workspaces
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToSlackWorkspaces(user.uid, (wsList) => {
      setWorkspaces(wsList);
      setActiveTeamId((current) => current ?? wsList[0]?.teamId ?? null);
    });
    return unsub;
  }, [user]);

  // After OAuth redirect, surface a status banner
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const status = url.searchParams.get("slack");
    if (!status) return;
    if (status === "connected") {
      const teamId = url.searchParams.get("teamId");
      setStatusMessage(`Slack workspace connected${teamId ? ` (${teamId})` : ""} — pick channels next.`);
      if (teamId) setActiveTeamId(teamId);
    } else if (status === "denied") {
      setStatusMessage("Slack install denied.");
    } else if (status === "error") {
      setStatusMessage("Slack install failed. Try again.");
    }
    url.searchParams.delete("slack");
    url.searchParams.delete("teamId");
    window.history.replaceState({}, "", url.pathname + (url.search ? "?" + url.searchParams : ""));
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.teamId === activeTeamId) ?? null,
    [workspaces, activeTeamId]
  );

  // Subscribe to messages for the active workspace
  useEffect(() => {
    if (!user || !activeTeamId) {
      setMessages([]);
      return;
    }
    const unsub = subscribeToSlackMessages(
      user.uid,
      (msgs) => setMessages(msgs),
      { teamId: activeTeamId }
    );
    return unsub;
  }, [user, activeTeamId]);

  // Channel name lookup for nicer rendering
  const channelNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of channels) map[c.id] = c.name;
    return map;
  }, [channels]);

  const handleConnect = () => {
    if (!user) return;
    window.location.href = `${API_BASE}/auth/slack/install?userId=${encodeURIComponent(user.uid)}`;
  };

  const handleOpenChannelPicker = async () => {
    if (!user || !activeTeamId) return;
    setShowChannelPicker(true);
    setChannelsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/auth/slack/channels?userId=${encodeURIComponent(user.uid)}&teamId=${encodeURIComponent(activeTeamId)}`
      );
      const json = (await res.json()) as { ok: boolean; channels?: SlackChannel[]; error?: string };
      if (!json.ok) throw new Error(json.error || "Failed to list channels");
      setChannels(json.channels ?? []);
      setPickerSelection(new Set(activeWorkspace?.selectedChannels ?? []));
    } catch (err) {
      setStatusMessage(`Could not load channels: ${(err as Error).message}`);
      setShowChannelPicker(false);
    } finally {
      setChannelsLoading(false);
    }
  };

  const togglePick = (channelId: string) => {
    setPickerSelection((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const handleSaveChannels = async () => {
    if (!user || !activeTeamId) return;
    setSavingChannels(true);
    try {
      const res = await fetch(`${API_BASE}/auth/slack/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          teamId: activeTeamId,
          selectedChannels: Array.from(pickerSelection),
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Failed to save");
      setShowChannelPicker(false);
      setStatusMessage(`Saved ${pickerSelection.size} channel${pickerSelection.size === 1 ? "" : "s"}.`);
    } catch (err) {
      setStatusMessage(`Save failed: ${(err as Error).message}`);
    } finally {
      setSavingChannels(false);
    }
  };

  const handleBackfill = async () => {
    if (!user || !activeTeamId) return;
    setBackfilling(true);
    setStatusMessage("Fetching message history…");
    try {
      const res = await fetch(`${API_BASE}/auth/slack/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, teamId: activeTeamId, limit: 200 }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        ingested?: number;
        errors?: { channel: string; error: string }[];
        error?: string;
      };
      if (!json.ok) throw new Error(json.error || "Backfill failed");
      const errCount = json.errors?.length ?? 0;
      setStatusMessage(
        `Backfilled ${json.ingested ?? 0} messages${errCount ? ` (${errCount} channel error${errCount === 1 ? "" : "s"})` : ""}.`
      );
    } catch (err) {
      setStatusMessage(`Backfill failed: ${(err as Error).message}`);
    } finally {
      setBackfilling(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user || !activeTeamId) return;
    if (!confirm(`Disconnect ${activeWorkspace?.teamName ?? "this workspace"}? Existing messages stay in your account.`)) return;
    try {
      const res = await fetch(
        `${API_BASE}/auth/slack/disconnect?userId=${encodeURIComponent(user.uid)}&teamId=${encodeURIComponent(activeTeamId)}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Disconnect failed");
      setActiveTeamId(null);
      setStatusMessage("Workspace disconnected.");
    } catch (err) {
      setStatusMessage(`Disconnect failed: ${(err as Error).message}`);
    }
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sign in to connect Slack.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-6 py-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-medium text-foreground">Slack</h2>
            <p className="text-xs text-muted-foreground">
              {workspaces.length === 0
                ? "No workspaces connected"
                : `${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"} connected`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {workspaces.length > 0 && (
            <select
              value={activeTeamId ?? ""}
              onChange={(e) => setActiveTeamId(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-sm"
            >
              {workspaces.map((ws) => (
                <option key={ws.teamId} value={ws.teamId}>
                  {ws.teamName}
                </option>
              ))}
            </select>
          )}
          <Button onClick={handleConnect} size="sm" variant="outline">
            <Plug className="mr-1 h-3 w-3" />
            Connect Slack
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div className="border-b border-border/70 bg-muted/40 px-6 py-2 text-xs text-foreground">
          {statusMessage}
        </div>
      )}

      {workspaces.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
          <Plug2 className="h-8 w-8 opacity-60" />
          <p className="max-w-sm">
            Connect your Slack workspace to ingest channel conversations into Buildcase.
            You&apos;ll choose which channels to sync.
          </p>
          <Button onClick={handleConnect}>
            <Plug className="mr-2 h-4 w-4" />
            Connect Slack
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-6 py-3">
            <span className="text-xs text-muted-foreground">
              {activeWorkspace?.selectedChannels?.length
                ? `Syncing ${activeWorkspace.selectedChannels.length} channel${activeWorkspace.selectedChannels.length === 1 ? "" : "s"}`
                : "No channels selected"}
            </span>
            <Button onClick={handleOpenChannelPicker} size="sm" variant="outline" className="ml-auto">
              <Hash className="mr-1 h-3 w-3" />
              Choose channels
            </Button>
            <Button onClick={handleBackfill} size="sm" variant="outline" disabled={backfilling || !activeWorkspace?.selectedChannels?.length}>
              {backfilling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
              Fetch history
            </Button>
            <Button onClick={handleDisconnect} size="sm" variant="outline">
              <Trash2 className="mr-1 h-3 w-3" />
              Disconnect
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <p>No messages yet for this workspace.</p>
                <p className="text-xs">
                  Choose channels, then click &quot;Fetch history&quot; or send a message in Slack.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {messages.map((msg) => (
                  <li
                    key={msg.id}
                    className="rounded-lg border border-border/60 bg-card/50 p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{msg.userId ?? "unknown"}</span>
                        {msg.channelId && (
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {channelNameById[msg.channelId] ?? msg.channelId}
                          </span>
                        )}
                        {msg.source === "backfill" && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                            history
                          </span>
                        )}
                      </div>
                      <span>{formatRelativeTime(msg.slackTs)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {msg.text || <em className="text-muted-foreground">(no text)</em>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {showChannelPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-medium">Choose channels to sync</h3>
              <p className="text-xs text-muted-foreground">
                {activeWorkspace?.teamName}
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto px-2 py-2">
              {channelsLoading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading channels…
                </div>
              ) : channels.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No channels found. Make sure the bot has been invited to channels.
                </p>
              ) : (
                <ul>
                  {channels.map((ch) => {
                    const checked = pickerSelection.has(ch.id);
                    return (
                      <li key={ch.id}>
                        <button
                          onClick={() => togglePick(ch.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                            checked ? "bg-muted" : ""
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          {ch.is_private ? <Lock className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                          <span className="flex-1 truncate">{ch.name}</span>
                          {!ch.is_member && (
                            <span className="text-[10px] text-muted-foreground">not joined</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <span className="mr-auto text-xs text-muted-foreground">
                {pickerSelection.size} selected
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowChannelPicker(false)} disabled={savingChannels}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveChannels} disabled={savingChannels}>
                {savingChannels ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
