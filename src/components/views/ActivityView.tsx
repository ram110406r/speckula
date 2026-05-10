"use client";

import React, { useState } from "react";
import {
  Activity, Filter, Download, Lightbulb, Compass,
  LayoutDashboard, CheckSquare, Sparkles, Users,
  FileText, Clock, Search, ChevronDown
} from "lucide-react";

type EventType = "all" | "signal" | "decision" | "spec" | "task" | "ai" | "auth";

interface ActivityEvent {
  id: string;
  type: Exclude<EventType, "all">;
  actor: string;
  avatar: string;
  avatarColor: string;
  action: string;
  subject: string;
  meta?: string;
  timestamp: string;
  date: string;
}

const EVENTS: ActivityEvent[] = [
  { id: "e1",  type: "ai",       actor: "Speckula AI",  avatar: "AI", avatarColor: "bg-primary",    action: "completed analysis of",    subject: "figma.com/pricing",                   meta: "3 signals extracted",    timestamp: "09:41",       date: "Today"      },
  { id: "e2",  type: "signal",   actor: "You",          avatar: "Y",  avatarColor: "bg-slate-500",  action: "added signal",             subject: "Users drop off at checkout step 3",   meta: "Conversion",             timestamp: "09:30",       date: "Today"      },
  { id: "e3",  type: "task",     actor: "James R.",     avatar: "JR", avatarColor: "bg-blue-500",   action: "completed task",           subject: "Add form validation",                  meta: "Checkout Redesign",      timestamp: "08:55",       date: "Today"      },
  { id: "e4",  type: "decision", actor: "Sarah K.",     avatar: "SK", avatarColor: "bg-pink-500",   action: "commented on",             subject: "Prioritize mobile checkout",           meta: "2 votes",                timestamp: "08:20",       date: "Today"      },
  { id: "e5",  type: "spec",     actor: "You",          avatar: "Y",  avatarColor: "bg-slate-500",  action: "published spec",           subject: "Mobile Checkout v2",                   meta: "Shared with engineering",timestamp: "Yesterday",   date: "Yesterday"  },
  { id: "e6",  type: "signal",   actor: "Priya M.",     avatar: "PM", avatarColor: "bg-emerald-500",action: "captured signal from",     subject: "ProductHunt: Competitor A checkout",   meta: "Extension",              timestamp: "14:30",       date: "Yesterday"  },
  { id: "e7",  type: "decision", actor: "You",          avatar: "Y",  avatarColor: "bg-slate-500",  action: "created decision",         subject: "Choose payment provider",              meta: "High priority",          timestamp: "11:00",       date: "Yesterday"  },
  { id: "e8",  type: "task",     actor: "Alex T.",      avatar: "AT", avatarColor: "bg-amber-500",  action: "assigned task to you",     subject: "Implement address autofill",           meta: "Checkout Redesign",      timestamp: "10:15",       date: "Yesterday"  },
  { id: "e9",  type: "auth",     actor: "You",          avatar: "Y",  avatarColor: "bg-slate-500",  action: "signed in from",           subject: "Chrome on macOS",                      meta: "London, UK",             timestamp: "09:00",       date: "Yesterday"  },
  { id: "e10", type: "ai",       actor: "Speckula AI",  avatar: "AI", avatarColor: "bg-primary",    action: "generated weekly summary", subject: "12 signals · 4 decisions · 1 spec",   meta: "Week 19",                timestamp: "Mon",         date: "This week"  },
  { id: "e11", type: "signal",   actor: "You",          avatar: "Y",  avatarColor: "bg-slate-500",  action: "imported signals from",    subject: "PostHog funnel analysis",              meta: "7 signals",              timestamp: "Mon",         date: "This week"  },
  { id: "e12", type: "auth",     actor: "Maria S.",     avatar: "MS", avatarColor: "bg-violet-500", action: "joined workspace as",      subject: "Contributor",                          meta: "",                       timestamp: "Sun",         date: "This week"  },
];

const FILTER_TABS: { key: EventType; label: string; icon: React.ElementType }[] = [
  { key: "all",      label: "All",       icon: Activity      },
  { key: "ai",       label: "AI",        icon: Sparkles      },
  { key: "signal",   label: "Signals",   icon: Lightbulb     },
  { key: "decision", label: "Decisions", icon: Compass       },
  { key: "spec",     label: "Specs",     icon: LayoutDashboard },
  { key: "task",     label: "Tasks",     icon: CheckSquare   },
  { key: "auth",     label: "Auth",      icon: Users         },
];

const TYPE_CONFIG: Record<Exclude<EventType, "all">, { icon: React.ElementType; color: string; bg: string }> = {
  ai:       { icon: Sparkles,        color: "text-primary",    bg: "bg-primary/10"    },
  signal:   { icon: Lightbulb,       color: "text-amber-500",  bg: "bg-amber-500/10"  },
  decision: { icon: Compass,         color: "text-blue-500",   bg: "bg-blue-500/10"   },
  spec:     { icon: LayoutDashboard, color: "text-green-500",  bg: "bg-green-500/10"  },
  task:     { icon: CheckSquare,     color: "text-purple-500", bg: "bg-purple-500/10" },
  auth:     { icon: Users,           color: "text-slate-500",  bg: "bg-slate-500/10"  },
};

export function ActivityView() {
  const [filter, setFilter]   = useState<EventType>("all");
  const [search, setSearch]   = useState("");
  const [limit,  setLimit]    = useState(10);

  const filtered = EVENTS.filter((e) => {
    const matchType   = filter === "all" || e.type === filter;
    const matchSearch = !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.actor.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const grouped = filtered.slice(0, limit).reduce<Record<string, ActivityEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
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
        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Activity className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No activity found</p>
            <p className="text-xs text-muted-foreground">Try a different filter or search term</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, events]) => (
              <div key={date}>
                {/* Date group header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{date}</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>

                {/* Events */}
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-border/40" />
                  <div className="space-y-1">
                    {events.map((ev) => {
                      const cfg = TYPE_CONFIG[ev.type];
                      return (
                        <div key={ev.id} className="relative flex items-start gap-4 pl-3 py-2 group rounded-lg hover:bg-muted/30 transition-colors">
                          {/* Type icon (on timeline) */}
                          <div className={`relative z-10 flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-0.5 ${cfg.bg}`}>
                            <cfg.icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              {/* Actor avatar inline */}
                              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white ${ev.avatarColor} shrink-0`}>
                                {ev.avatar.slice(0,2)}
                              </span>
                              <span className="text-xs font-semibold text-foreground">{ev.actor}</span>
                              <span className="text-[11px] text-muted-foreground">{ev.action}</span>
                              <span className="text-[11px] font-medium text-foreground truncate max-w-[200px]">{ev.subject}</span>
                            </div>
                            {ev.meta && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 ml-5">{ev.meta}</p>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground/60">
                            <Clock className="h-2.5 w-2.5" />
                            {ev.timestamp}
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
              onClick={() => setLimit((l) => l + 10)}
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
