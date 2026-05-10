"use client";

import React, { useState } from "react";
import {
  Bell, CheckCheck, Trash2, Lightbulb, Compass,
  LayoutDashboard, CheckSquare, Sparkles, Users,
  Settings, Filter, X
} from "lucide-react";

type NotifType = "all" | "signal" | "decision" | "spec" | "task" | "ai" | "team";

interface Notification {
  id: string;
  type: Exclude<NotifType, "all">;
  title: string;
  body: string;
  time: string;
  read: boolean;
  actor?: string;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "n1",  type: "ai",       title: "AI Insight Ready",                    body: "Your competitive analysis of Figma's pricing page has been processed. 3 key signals identified.",         time: "2m ago",  read: false, actor: "Speckula AI" },
  { id: "n2",  type: "team",     title: "Sarah commented on your decision",    body: "On 'Prioritize mobile checkout': 'I agree but we should check with the design team first.'",             time: "15m ago", read: false, actor: "Sarah K."    },
  { id: "n3",  type: "task",     title: "Task assigned to you",                body: "James assigned you 'Implement address autofill' in the Checkout Redesign spec.",                          time: "1h ago",  read: false, actor: "James R."    },
  { id: "n4",  type: "signal",   title: "New signal added",                    body: "Priya captured a signal from ProductHunt: 'Competitor A launched one-click checkout this morning.'",    time: "2h ago",  read: true,  actor: "Priya M."    },
  { id: "n5",  type: "decision", title: "Decision needs your input",           body: "'Choose payment provider' is awaiting your vote. Deadline: tomorrow.",                                    time: "3h ago",  read: true                           },
  { id: "n6",  type: "spec",     title: "Spec published",                      body: "Mobile Checkout v2 PRD has been published and shared with the engineering team.",                         time: "5h ago",  read: true,  actor: "Alex T."     },
  { id: "n7",  type: "ai",       title: "Weekly summary ready",                body: "Your product intelligence summary for the week is ready. 12 signals, 4 decisions, 1 new spec.",         time: "1d ago",  read: true,  actor: "Speckula AI" },
  { id: "n8",  type: "team",     title: "New team member joined",              body: "Maria S. joined your workspace as a Contributor.",                                                         time: "2d ago",  read: true,  actor: "Maria S."    },
];

const TAB_CONFIG: { key: NotifType; label: string; icon: React.ElementType }[] = [
  { key: "all",      label: "All",       icon: Bell          },
  { key: "ai",       label: "AI",        icon: Sparkles      },
  { key: "team",     label: "Team",      icon: Users         },
  { key: "signal",   label: "Signals",   icon: Lightbulb     },
  { key: "decision", label: "Decisions", icon: Compass       },
  { key: "spec",     label: "Specs",     icon: LayoutDashboard },
  { key: "task",     label: "Tasks",     icon: CheckSquare   },
];

const TYPE_STYLES: Record<Exclude<NotifType, "all">, { icon: React.ElementType; color: string; bg: string }> = {
  ai:       { icon: Sparkles,       color: "text-primary",    bg: "bg-primary/10"    },
  team:     { icon: Users,          color: "text-blue-500",   bg: "bg-blue-500/10"   },
  signal:   { icon: Lightbulb,      color: "text-amber-500",  bg: "bg-amber-500/10"  },
  decision: { icon: Compass,        color: "text-indigo-500", bg: "bg-indigo-500/10" },
  spec:     { icon: LayoutDashboard, color: "text-green-500", bg: "bg-green-500/10"  },
  task:     { icon: CheckSquare,    color: "text-purple-500", bg: "bg-purple-500/10" },
};

export function NotificationsView() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab]         = useState<NotifType>("all");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = activeTab === "all"
    ? notifications
    : notifications.filter((n) => n.type === activeTab);

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const dismiss = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const clearAll = () => setNotifications([]);

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
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
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

        {/* ── Notification list ── */}
        {filtered.length === 0 ? (
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
                  onClick={() => markRead(notif.id)}
                  className={`group relative flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                    notif.read
                      ? "border-border/40 bg-card hover:bg-muted/30"
                      : "border-primary/20 bg-primary/5 hover:bg-primary/8"
                  }`}
                >
                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary" />
                  )}

                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${style.bg} shrink-0 mt-0.5`}>
                    <style.icon className={`h-3.5 w-3.5 ${style.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-baseline gap-2">
                      <p className={`text-xs font-semibold truncate ${notif.read ? "text-foreground" : "text-foreground"}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{notif.time}</span>
                    </div>
                    {notif.actor && (
                      <p className="text-[10px] text-primary/70 mt-0.5">{notif.actor}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {notif.body}
                    </p>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}
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
