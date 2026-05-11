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

export type SpeckulaEvent =
  | { type: "extension.connected";    userId: string; data: { connectionId: string } }
  | { type: "extension.disconnected"; userId: string; data: { connectionId: string } }
  | { type: "analysis.queued";        userId: string; data: { jobId: string } }
  | { type: "analysis.progress";      userId: string; data: { jobId: string; stage: string; progress: number } }
  | { type: "analysis.completed";     userId: string; data: { jobId: string; entriesCreated: number } }
  | { type: "analysis.failed";        userId: string; data: { jobId: string; error: string } }
  | { type: "insight.created";        userId: string; data: { entryId: string; entryType: string } }
  | { type: "notification.created";   userId: string; data: { notificationId: string; title: string } }
  | { type: "connected";              connectionId: string; userId: string; serverTime: string }
  | { type: "pong";                   serverTime: string }
  | { type: "error";                  code: string; message: string };

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

const PING_INTERVAL_MS  = 30_000;
const TOKEN_REFRESH_MS  = 55 * 60 * 1000;
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 8;

export function useSpecklaBus() {
  const [status, setStatus]     = useState<ConnectionStatus>("disconnected");
  const [lastEvent, setLastEvent] = useState<SpeckulaEvent | null>(null);

  const wsRef           = useRef<WebSocket | null>(null);
  const pingTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef     = useRef(0);
  const mountedRef      = useRef(true);

  const clearTimers = useCallback(() => {
    if (pingTimerRef.current)  { clearInterval(pingTimerRef.current);  pingTimerRef.current  = null; }
    if (tokenTimerRef.current) { clearInterval(tokenTimerRef.current); tokenTimerRef.current = null; }
    if (reconnectRef.current)  { clearTimeout(reconnectRef.current);   reconnectRef.current  = null; }
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    let token: string;
    try {
      token = await user.getIdToken();
    } catch {
      return;
    }

    if (!mountedRef.current) return;

    setStatus("connecting");

    const url = `${getWsBase()}/ws?token=${encodeURIComponent(token)}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setStatus("connected");
      attemptsRef.current = 0;

      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL_MS);

      tokenTimerRef.current = setInterval(async () => {
        const freshToken = await auth.currentUser?.getIdToken(true).catch(() => null);
        if (!freshToken || ws.readyState !== WebSocket.OPEN) return;
        // Re-connect with the fresh token — the server verifies on connect only.
        ws.close(1000, "token-refresh");
      }, TOKEN_REFRESH_MS);
    };

    ws.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data as string) as SpeckulaEvent;
        setLastEvent(event);
      } catch {
        // ignore unparseable frames
      }
    };

    ws.onclose = (ev) => {
      clearTimers();
      wsRef.current = null;
      if (!mountedRef.current) return;

      setStatus("disconnected");

      // Normal close (1000/1001) or too many attempts → stop reconnecting.
      if (ev.code === 1000 || ev.code === 1001) {
        // Deliberate close (e.g. token refresh cycle) — reconnect immediately.
        if (mountedRef.current) connect();
        return;
      }
      if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;

      attemptsRef.current += 1;
      const delay = RECONNECT_DELAY_MS * Math.min(attemptsRef.current, 4);
      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setStatus("error");
      // onclose fires after onerror — reconnect logic lives there.
    };
  }, [clearTimers]);

  useEffect(() => {
    mountedRef.current = true;

    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        connect();
      } else {
        clearTimers();
        wsRef.current?.close(1000, "signed-out");
        wsRef.current = null;
        setStatus("disconnected");
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      clearTimers();
      wsRef.current?.close(1000, "unmount");
      wsRef.current = null;
    };
  }, [connect, clearTimers]);

  return { status, connected: status === "connected", lastEvent };
}
