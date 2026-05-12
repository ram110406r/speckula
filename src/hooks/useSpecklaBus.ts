"use client";

// useSpecklaBus — WebSocket connection to the Fastify /ws gateway.
//
// Usage:
//   const { connected, lastEvent } = useSpecklaBus();
//
// The hook connects automatically when the user is authenticated and
// disconnects on unmount or sign-out. Firebase ID tokens are refreshed
// every 55 minutes (well within the 60-minute Firebase expiry).
//
// Events received are the full SpeckulaEvent union from the backend.

import { useEffect, useRef, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { getExtensionPreferences } from "@/lib/firebase/db";

export type SpeckulaEvent =
  | { type: "extension.connected";    userId: string; data: { connectionId: string } }
  | { type: "extension.disconnected"; userId: string; data: { connectionId: string } }
  | { type: "analysis.queued";        userId: string; data: { jobId: string } }
  | { type: "analysis.progress";      userId: string; data: { jobId: string; status?: string; stage?: string; progress: number } }
  | { type: "analysis.completed";     userId: string; data: { jobId: string; result?: unknown } }
  | { type: "analysis.failed";        userId: string; data: { jobId: string; error: string } }
  | { type: "insight.created";        userId: string; data: { entryId: string; entryType: string; title?: string } }
  | { type: "notification.created";   userId: string; data: { notificationId: string; title: string } }
  | { type: "connected";              connectionId: string; userId: string; workspaceId?: string | null; serverTime: string }
  | { type: "pong";                   serverTime: string }
  | { type: "error";                  code: string; message: string };

type AnyEvent = { type: string; [key: string]: unknown };

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

// Derive the WebSocket base URL. In production the WS gateway sits behind the
// same host as the app (nginx routes /ws → backend), so we derive from
// window.location when NEXT_PUBLIC_WS_URL is not explicitly set. A relative
// URL string is invalid for the WebSocket constructor, so we always build an
// absolute ws:// / wss:// URL.
const getWsBase = (): string => {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "ws://localhost:3001";
};

const PING_INTERVAL_MS = 30_000;
const TOKEN_REFRESH_MS = 55 * 60 * 1000;
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 8;

type Listener = (s: { status: ConnectionStatus; lastEvent: AnyEvent | null }) => void;

const bus = {
  status: "disconnected" as ConnectionStatus,
  lastEvent: null as AnyEvent | null,
  ws: null as WebSocket | null,
  pingTimer: null as ReturnType<typeof setInterval> | null,
  tokenTimer: null as ReturnType<typeof setInterval> | null,
  reconnectTimer: null as ReturnType<typeof setTimeout> | null,
  attempts: 0,
  listeners: new Set<Listener>(),
  desiredWorkspaceId: null as string | null,
  currentWorkspaceId: null as string | null,
  authUnsub: null as (() => void) | null,
  bootstrapped: false,

  notify() {
    for (const l of this.listeners) {
      try { l({ status: this.status, lastEvent: this.lastEvent }); } catch { /* ignore */ }
    }
  },

  clearTimers() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.tokenTimer) { clearInterval(this.tokenTimer); this.tokenTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  },

  async resolveWorkspaceId(explicitWorkspaceId?: string | null): Promise<string | null> {
    if (explicitWorkspaceId) return explicitWorkspaceId;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;
    try {
      const prefs = await getExtensionPreferences(user.uid);
      return typeof prefs.activeWorkspaceId === "string" ? prefs.activeWorkspaceId : null;
    } catch {
      return null;
    }
  },

  async connect(workspaceIdHint?: string | null) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const resolvedWorkspaceId = await this.resolveWorkspaceId(workspaceIdHint);
    this.desiredWorkspaceId = resolvedWorkspaceId;

    // If we're already connected/connecting for the same workspace, do nothing.
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.currentWorkspaceId === resolvedWorkspaceId) return;
      try { this.ws.close(1000, "workspace-change"); } catch { /* ignore */ }
    }

    let token: string;
    try {
      token = await user.getIdToken();
    } catch {
      return;
    }

    this.status = "connecting";
    this.notify();

    const qs = new URLSearchParams({ token });
    if (resolvedWorkspaceId) qs.set("workspaceId", resolvedWorkspaceId);

    const url = `${getWsBase()}/ws?${qs.toString()}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.currentWorkspaceId = resolvedWorkspaceId;

    ws.onopen = () => {
      this.status = "connected";
      this.attempts = 0;
      this.notify();

      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, PING_INTERVAL_MS);

      this.tokenTimer = setInterval(async () => {
        const freshToken = await auth.currentUser?.getIdToken(true).catch(() => null);
        if (!freshToken || ws.readyState !== WebSocket.OPEN) return;
        ws.close(1000, "token-refresh");
      }, TOKEN_REFRESH_MS);
    };

    ws.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data as string) as AnyEvent;
        this.lastEvent = event;
        this.notify();
      } catch {
        // ignore
      }
    };

    ws.onclose = (ev) => {
      this.clearTimers();
      this.ws = null;
      this.currentWorkspaceId = null;
      this.status = "disconnected";
      this.notify();

      if (ev.code === 1000 || ev.code === 1001) {
        this.connect(this.desiredWorkspaceId);
        return;
      }

      if (this.attempts >= MAX_RECONNECT_ATTEMPTS) return;
      this.attempts += 1;
      const delay = RECONNECT_DELAY_MS * Math.min(this.attempts, 4);
      this.reconnectTimer = setTimeout(() => this.connect(this.desiredWorkspaceId), delay);
    };

    ws.onerror = () => {
      this.status = "error";
      this.notify();
    };
  },

  disconnect(reason: string) {
    this.clearTimers();
    this.ws?.close(1000, reason);
    this.ws = null;
    this.status = "disconnected";
    this.notify();
  },

  bootstrap() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    const auth = getAuth();
    this.authUnsub = auth.onAuthStateChanged((user) => {
      if (user) {
        this.connect(this.desiredWorkspaceId);
      } else {
        this.disconnect("signed-out");
      }
    });
  },
};

export function useSpecklaBus(workspaceId?: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>(bus.status);
  const [lastEvent, setLastEvent] = useState<AnyEvent | null>(bus.lastEvent);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    bus.bootstrap();

    if (workspaceId !== undefined && workspaceId !== bus.desiredWorkspaceId) {
      bus.desiredWorkspaceId = workspaceId;
      // Force reconnect if already connected.
      if (bus.ws && bus.ws.readyState === WebSocket.OPEN) {
        bus.ws.close(1000, "workspace-change");
      } else {
        bus.connect(workspaceId);
      }
    }

    const listener: Listener = ({ status: nextStatus, lastEvent: nextEvent }) => {
      if (!mountedRef.current) return;
      setStatus(nextStatus);
      setLastEvent(nextEvent);
    };

    bus.listeners.add(listener);
    // Sync immediately.
    listener({ status: bus.status, lastEvent: bus.lastEvent });

    return () => {
      mountedRef.current = false;
      bus.listeners.delete(listener);
    };
  }, [workspaceId]);

  return { status, connected: status === "connected", lastEvent };
}
