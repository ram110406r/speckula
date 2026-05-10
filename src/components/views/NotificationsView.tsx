"use client";

import React, { useState, useEffect } from "react";
import {
  Bell, CheckCheck, Trash2, Lightbulb, Compass,
  LayoutDashboard, CheckSquare, Sparkles, Users,
  Settings, X, Loader2
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearAllNotifications,
  type SpNotification,
  type NotifType,
} from "@/lib/firebase/db";

type FilterKey = "all" | NotifType;

const TAB_CONFIG: { key: FilterKey; label: string; icon: React.ElementType }[] = [
  { key: "all",      label: "All",       icon: Bell           },
  { key: "ai",       label: "AI",        icon: Sparkles       },
  { key: "team",     label: "Team",      icon: Users          },
  { key: "signal",   label: "Signals",   icon: Lightbulb      },
  { key: "decision", label: "Decisions", icon: Compass        },
  { key: "spec",     label: "Specs",     icon: LayoutDashboard },
  { key: "task",     label: "Tasks",     icon: CheckSquare    },
];

const TYPE_STYLES: Record<NotifType, { icon: React.ElementType; color: string; bg: string }> = {
  ai:       { icon: Sparkles,        color: "text-primary",    bg: "bg-primary/10"    },
  team:     { icon: Users,           color: "text-blue-500",   bg: "bg-blue-500/10"   },
  signal:   { icon: Lightbulb,       color: "text-amber-500",  bg: "bg-amber-500/10"  },
  decision: { icon: Compass,         color: "text-indigo-500", bg: "bg-indigo-500/10" },
  spec:     { icon: LayoutDashboard, color: "text-green-500",  bg: "bg-green-500/10"  },
  task:     { icon: CheckSquare,     color: "text-purple-500", bg: "bg-purple-500/10" },
};

function timeAgo(ts: SpNotification["createdAt"]): string {
  if (!ts) return "";
  const ms = Date.now() - ts.toDate().getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function NotificationsView() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<SpNotification[]>([]);
  const [activeTab, setActiveTab]         = useState<FilterKey>("all");
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const unsub = subscribeToNotifications(
      user.uid,
      (notifs) => { setNotifications(notifs); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = activeTab === "all"
    ? notifications
    : notifications.filter((n) => n.type === activeTab);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
  };

  const handleMarkRead = async (id: string) => {
    if (!user || !id) return;
    await markNotificationRead(user.uid, id);
  };

  const handleDismiss = async (id: string) => {
    if (!user || !id) return;
    await dismissNotification(user.uid, id);
  };

  const handleClearAll = async () => {
    if (!user) return;
    await clearAllNotifications(user.uid);
  };

  return (
    <div className="h-full overflow-y-auto bg-background custom-scrollbar">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Stay on top of signals, decisions, and team activity</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 custom-scrollbar">
          {TAB_CONFIG.map((tab) => {
            const count = tab.key === "all"
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => n.type === tab.key && !n.read).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
                }`}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
                {count > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="p-4 rounded-full bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground">No notifications in this category</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((notif) => {
              const style = TYPE_STYLES[notif.type];
              return (
                <div
                  key={notif.id}
                  onClick={() => handleMarkRead(notif.id!)}
                  className={`group relative flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                    notif.read
                      ? "border-border/40 bg-card hover:bg-muted/30"
                      : "border-primary/20 bg-primary/5 hover:bg-primary/8"
                  }`}
                >
                  {!notif.read && (
                    <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary" />
                  )}

                  <div className={`p-2 rounded-lg ${style.bg} shrink-0 mt-0.5`}>
                    <style.icon className={`h-3.5 w-3.5 ${style.color}`} />
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-baseline gap-2">
                      <p className="text-xs font-semibold truncate text-foreground">{notif.title}</p>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgo(notif.createdAt)}</span>
                    </div>
                    {notif.actor && (
                      <p className="text-[10px] text-primary/70 mt-0.5">{notif.actor}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {notif.body}
                    </p>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDismiss(notif.id!); }}
                    className="absolute top-3.5 right-3.5 p-1 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    aria-label="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Preferences link ── */}
        <div className="mt-6 text-center">
          <button className="flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="h-3 w-3" />
            Manage notification preferences
          </button>
        </div>

      </div>
    </div>
  );
}
