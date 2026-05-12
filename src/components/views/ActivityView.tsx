"use client";

import React, { useState, useEffect } from "react";
import {
  Activity, Download, Lightbulb, Compass,
  LayoutDashboard, CheckSquare, Sparkles, Users,
  Clock, Search, ChevronDown, Loader2
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { subscribeToActivity, type ActivityEvent, type ActivityEventType } from "@/lib/firebase/db";
import { useApi } from "@/hooks/useApi";
import { useExtensionPreferences } from "@/hooks/useExtensionPreferences";
import { useSpecklaBus } from "@/hooks/useSpecklaBus";

type FilterKey = "all" | ActivityEventType;

const FILTER_TABS: { key: FilterKey; label: string; icon: React.ElementType }[] = [
  { key: "all",      label: "All",       icon: Activity        },
  { key: "ai",       label: "AI",        icon: Sparkles        },
  { key: "signal",   label: "Signals",   icon: Lightbulb       },
  { key: "decision", label: "Decisions", icon: Compass         },
  { key: "spec",     label: "Specs",     icon: LayoutDashboard },
  { key: "task",     label: "Tasks",     icon: CheckSquare     },
  { key: "auth",     label: "Auth",      icon: Users           },
];

const TYPE_CONFIG: Record<ActivityEventType, { icon: React.ElementType; color: string; bg: string }> = {
  ai:       { icon: Sparkles,        color: "text-primary",    bg: "bg-primary/10"   },
  signal:   { icon: Lightbulb,       color: "text-amber-500",  bg: "bg-amber-500/10"  },
  decision: { icon: Compass,         color: "text-blue-500",   bg: "bg-blue-500/10"   },
  spec:     { icon: LayoutDashboard, color: "text-green-500",  bg: "bg-green-500/10"  },
  task:     { icon: CheckSquare,     color: "text-purple-500", bg: "bg-purple-500/10" },
  auth:     { icon: Users,           color: "text-slate-500",  bg: "bg-slate-500/10"  },
};

function dateLabel(ts: ActivityEvent["createdAt"]): string {
  if (!ts) return "Unknown";
  const d = toDate(ts);
  if (!d) return "Unknown";
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function timeLabel(ts: ActivityEvent["createdAt"]): string {
  if (!ts) return "";
  const d = toDate(ts);
  if (!d) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") {
    const parsed = new Date(ts);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "object") {
    const t = ts as { seconds?: number; toDate?: () => Date };
    if (typeof t.toDate === "function") return t.toDate();
    if (typeof t.seconds === "number") return new Date(t.seconds * 1000);
  }
  return null;
}

function actorInitials(actor: string): string {
  return actor === "You" ? "Y" : actor.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["bg-slate-500", "bg-blue-500", "bg-pink-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500"];
const colorFor = (s: string) => AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length];

export function ActivityView() {
  const { user } = useAuth();
  const { preferences } = useExtensionPreferences();
  const activeWorkspaceId = preferences?.activeWorkspaceId ?? null;

  type BackendActivityItem = {
    id: string;
    actorId: string;
    eventType: string;
    title: string;
    description: string | null;
    createdAt: string;
  };

  const { data: backendActivity, loading: backendLoading, refetch: refetchBackend } = useApi<{ items: BackendActivityItem[] }>(
    activeWorkspaceId ? `/api/workspaces/${activeWorkspaceId}/activity?limit=100` : "",
    { enabled: Boolean(activeWorkspaceId), refreshInterval: 60_000 }
  );

  const { lastEvent } = useSpecklaBus(activeWorkspaceId);

  const [events,  setEvents]  = useState<ActivityEvent[]>([]);
  const [filter,  setFilter]  = useState<FilterKey>("all");
  const [search,  setSearch]  = useState("");
  const [limit,   setLimit]   = useState(20);
  const [loading, setLoading] = useState(true);

  const effectiveLoading = activeWorkspaceId ? backendLoading : loading;

  useEffect(() => {
    if (!user) { return; }

    // Prefer backend workspace-scoped activity when a workspace is active.
    if (activeWorkspaceId) {
      const items = backendActivity?.items ?? [];
      const mapped: ActivityEvent[] = items.map((it) => {
        const type: ActivityEventType =
          it.eventType.startsWith("analysis.") ? "ai" :
          it.eventType.includes("signal") || it.eventType.includes("insight") || it.eventType.includes("competitor") ? "signal" :
          it.eventType.startsWith("workspace.") ? "auth" :
          "ai";

        const actor = it.actorId === user.uid ? "You" : it.actorId;
        const action =
          it.eventType === "analysis.queued" ? "queued an analysis" :
          it.eventType === "analysis.started" ? "started an analysis" :
          it.eventType === "analysis.completed" ? "completed an analysis" :
          it.eventType === "analysis.failed" ? "analysis failed" :
          it.eventType === "insight.created" ? "captured insight" :
          it.eventType === "market_signal.detected" ? "detected market signal" :
          it.eventType === "competitor.updated" ? "updated competitor" :
          it.eventType;

        return {
          id: it.id,
          type,
          actor,
          action,
          subject: it.title,
          meta: it.description ?? undefined,
          createdAt: it.createdAt as unknown as ActivityEvent["createdAt"],
        } as ActivityEvent;
      });

      setEvents(mapped);
      return;
    }

    const unsub = subscribeToActivity(
      user.uid,
      (data) => { setEvents(data); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [user, activeWorkspaceId, backendActivity, backendLoading]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (!lastEvent) return;
    if (lastEvent.type === "activity.created" || lastEvent.type.startsWith("analysis.") || lastEvent.type === "insight.created") {
      refetchBackend();
    }
  }, [activeWorkspaceId, lastEvent, refetchBackend]);

  const filtered = events.filter((e) => {
    const matchType   = filter === "all" || e.type === filter;
    const matchSearch = !search ||
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.actor.toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const paged = filtered.slice(0, limit);

  // Group by date label
  const grouped = paged.reduce<Record<string, ActivityEvent[]>>((acc, ev) => {
    const label = dateLabel(ev.createdAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(ev);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto bg-background custom-scrollbar">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Activity Log</h1>
            <p className="text-sm text-muted-foreground mt-0.5">A complete history of events in your workspace</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>

        {/* ── Search + filters ── */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search activity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === tab.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Timeline ── */}
        {effectiveLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Activity className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground">
              {search || filter !== "all"
                ? "Try a different filter or search term"
                : "Activity will appear here as you use SPECKULA"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, evs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{date}</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>

                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-border/40" />
                  <div className="space-y-1">
                    {evs.map((ev) => {
                      const cfg = TYPE_CONFIG[ev.type];
                      const initials = actorInitials(ev.actor);
                      const avatarColor = ev.actor === "You" ? "bg-slate-500" : colorFor(ev.actor);
                      return (
                        <div key={ev.id} className="relative flex items-start gap-4 pl-3 py-2 group rounded-lg hover:bg-muted/30 transition-colors">
                          <div className={`relative z-10 flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-0.5 ${cfg.bg}`}>
                            <cfg.icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white ${avatarColor} shrink-0`}>
                                {initials}
                              </span>
                              <span className="text-xs font-semibold text-foreground">{ev.actor}</span>
                              <span className="text-[11px] text-muted-foreground">{ev.action}</span>
                              <span className="text-[11px] font-medium text-foreground truncate max-w-[200px]">{ev.subject}</span>
                            </div>
                            {ev.meta && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 ml-5">{ev.meta}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground/60">
                            <Clock className="h-2.5 w-2.5" />
                            {timeLabel(ev.createdAt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Load more ── */}
        {filtered.length > limit && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setLimit((l) => l + 20)}
              className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" /> Load more
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
