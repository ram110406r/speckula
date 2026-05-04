"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Trash2, Sparkles, CheckCircle2, AlertTriangle, Info, BellOff } from "lucide-react";
import { useActivityStore, type ActivityEventType } from "@/store/useActivityStore";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_CONFIG: Record<ActivityEventType, { icon: React.ReactNode; color: string; border: string }> = {
  ai:      { icon: <Sparkles      className="h-3 w-3" />, color: "text-primary",   border: "border-l-primary/50"   },
  success: { icon: <CheckCircle2  className="h-3 w-3" />, color: "text-success",   border: "border-l-success/50"   },
  warning: { icon: <AlertTriangle className="h-3 w-3" />, color: "text-warning",   border: "border-l-warning/50"   },
  info:    { icon: <Info          className="h-3 w-3" />, color: "text-blue-400",  border: "border-l-blue-400/50"  },
};

interface Props {
  collapsed: boolean;
}

export function NotificationBell({ collapsed }: Props) {
  const { events, unreadCount, markAllRead, clear } = useActivityStore();
  const [open, setOpen] = React.useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; right: number } | null>(null);

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

  // compute coords for portal placement when opened
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setCoords({ top: r.top + window.scrollY, left: r.left + window.scrollX, right: r.right + window.scrollX });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

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

      {open && coords && createPortal(
        <div
          style={(() => {
            const vw = window.innerWidth;
            const panelWidth = Math.min(320, vw - 16);
            const idealLeft = collapsed ? coords.left : coords.right - panelWidth;
            const left = Math.max(8, Math.min(idealLeft, vw - panelWidth - 8));
            return {
              position: "absolute" as const,
              top: coords.top,
              left,
              width: panelWidth,
              zIndex: 99999,
              transform: "translateY(-8px) translateY(-100%)",
            };
          })()}
          className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={markAllRead}
                title="Mark all read"
                disabled={unreadCount === 0}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={clear}
                title="Clear all"
                disabled={events.length === 0}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-border/30">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2.5">
                <BellOff className="h-7 w-7 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/50">No notifications yet</p>
                <p className="text-[11px] text-muted-foreground/30 text-center max-w-[180px] leading-snug">
                  AI actions, saves, and completions will appear here
                </p>
              </div>
            ) : (
              events.map((e) => {
                const cfg = TYPE_CONFIG[e.type] ?? TYPE_CONFIG.info;
                return (
                  <div
                    key={e.id}
                    className={`flex gap-3 px-3.5 py-2.5 border-l-2 transition-colors ${
                      !e.read ? `${cfg.border} bg-muted/20` : "border-l-transparent"
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-medium leading-tight ${e.read ? "text-muted-foreground" : "text-foreground"}`}>
                          {e.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground/50 shrink-0 mt-0.5 tabular-nums whitespace-nowrap">
                          {timeAgo(e.timestamp)}
                        </span>
                      </div>
                      {e.description && (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">{e.description}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer count */}
          {events.length > 0 && (
            <div className="px-3.5 py-2 border-t border-border/40 bg-muted/10 text-center">
              <p className="text-[10px] text-muted-foreground/40">
                {events.length} notification{events.length !== 1 ? "s" : ""} · persisted across sessions
              </p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
