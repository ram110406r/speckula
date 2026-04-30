"use client";

import React, { useRef, useEffect } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useActivityStore } from "@/store/useActivityStore";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  collapsed: boolean;
}

export function NotificationBell({ collapsed }: Props) {
  const { events, unreadCount, markAllRead, clear } = useActivityStore();
  const [open, setOpen] = React.useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) markAllRead();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        title="Notifications"
        className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute z-50 bottom-full mb-2 w-72 rounded-lg border border-border bg-card shadow-xl overflow-hidden ${
            collapsed ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
            <span className="text-xs font-semibold text-foreground">Activity</span>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                title="Mark all read"
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={clear}
                title="Clear all"
                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-6">No activity yet</p>
            ) : (
              events.map((e) => (
                <div
                  key={e.id}
                  className={`px-3 py-2.5 border-b border-border/30 last:border-0 ${e.read ? "" : "bg-primary/5"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground leading-tight">{e.title}</p>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">{timeAgo(e.timestamp)}</span>
                  </div>
                  {e.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{e.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
