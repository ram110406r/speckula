"use client";

import React, { useState, useEffect } from "react";
import {
  Search, CheckCircle2, ExternalLink, Settings,
  Zap, AlertCircle, Plus, Loader2
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  subscribeToIntegrations,
  setIntegrationStatus,
  type IntegrationRecord,
} from "@/lib/firebase/db";

type IntegStatus = "connected" | "disconnected" | "error" | "coming_soon";

interface IntegMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  docsUrl?: string;
  comingSoon?: boolean;
}

const INTEG_META: IntegMeta[] = [
  { id: "slack",    name: "Slack",    category: "Communication",      logo: "SL", description: "Push signals and decisions to Slack channels. Get notified on important updates." },
  { id: "github",   name: "GitHub",   category: "Engineering",        logo: "GH", description: "Link tasks to GitHub issues and PRs. Track development progress automatically." },
  { id: "jira",     name: "Jira",     category: "Project Management", logo: "JI", description: "Sync tasks with Jira tickets. Keep your backlog in sync with your specs." },
  { id: "notion",   name: "Notion",   category: "Documentation",      logo: "NO", description: "Export specs and decisions to Notion pages. Keep your wiki up to date." },
  { id: "posthog",  name: "PostHog",  category: "Analytics",          logo: "PH", description: "Import user behavior data as signals. Correlate product decisions with metrics." },
  { id: "figma",    name: "Figma",    category: "Design",             logo: "FI", description: "Attach Figma prototypes to specs. Keep design and product in sync." },
  { id: "mixpanel", name: "Mixpanel", category: "Analytics",          logo: "MI", description: "Pull funnel analytics and retention data as evidence for your decisions." },
  { id: "linear",   name: "Linear",   category: "Project Management", logo: "LI", description: "Sync Speckula tasks with Linear issues. Automate your engineering workflow.", comingSoon: true },
  { id: "hubspot",  name: "HubSpot",  category: "CRM",               logo: "HS", description: "Import customer feedback and sales signals directly into your product brain.", comingSoon: true },
];

const CATEGORIES = ["All", ...Array.from(new Set(INTEG_META.map((i) => i.category)))];

const LOGO_COLORS: Record<string, string> = {
  SL: "bg-[#4A154B] text-white", GH: "bg-[#24292E] text-white",
  JI: "bg-[#0052CC] text-white", NO: "bg-[#000000] text-white",
  PH: "bg-[#F54E00] text-white", FI: "bg-[#F24E1E] text-white",
  MI: "bg-[#7856FF] text-white", LI: "bg-[#5E6AD2] text-white",
  HS: "bg-[#FF7A59] text-white",
};

const STATUS_CONFIG: Record<IntegStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  connected:    { label: "Connected",    color: "text-green-600",        bg: "bg-green-500/10", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", color: "text-muted-foreground", bg: "bg-muted",        icon: Plus         },
  error:        { label: "Error",        color: "text-red-500",          bg: "bg-red-500/10",   icon: AlertCircle  },
  coming_soon:  { label: "Coming soon",  color: "text-muted-foreground", bg: "bg-muted",        icon: Zap          },
};

interface MergedInteg extends IntegMeta {
  status: IntegStatus;
  connectedAs?: string;
  lastSync?: string;
}

function IntegrationCard({ integ, onConnect, onDisconnect }: {
  integ: MergedInteg;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}) {
  const st = STATUS_CONFIG[integ.status];
  const isConnected = integ.status === "connected";
  const isError     = integ.status === "error";
  const isSoon      = integ.status === "coming_soon";

  return (
    <div className={`flex flex-col gap-4 p-5 rounded-xl border transition-all ${
      isConnected ? "border-green-500/20 bg-green-500/5" :
      isError     ? "border-red-500/20 bg-red-500/5" :
      "border-border/60 bg-card hover:border-border hover:bg-muted/20"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${LOGO_COLORS[integ.logo] || "bg-muted text-foreground"}`}>
          {integ.logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{integ.name}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${st.bg} ${st.color}`}>
              {st.label}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{integ.category}</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">{integ.description}</p>

      {(isConnected || isError) && (
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          {integ.connectedAs && <div>Connected as: <span className="text-foreground font-medium">{integ.connectedAs}</span></div>}
          {integ.lastSync && !isError && <div>Last sync: <span className="text-foreground">{integ.lastSync}</span></div>}
          {isError && <div className="text-red-500">Sync failed — re-authentication required</div>}
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto">
        {isSoon ? (
          <button disabled className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium opacity-60 cursor-not-allowed">
            Coming soon
          </button>
        ) : isConnected ? (
          <>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Settings className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDisconnect(integ.id)}
              className="flex-1 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : isError ? (
          <button
            onClick={() => onConnect(integ.id)}
            className="flex-1 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-medium hover:bg-red-500/20 transition-colors"
          >
            Reconnect
          </button>
        ) : (
          <button
            onClick={() => onConnect(integ.id)}
            className="flex-1 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 border border-primary/20 transition-colors"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

export function IntegrationsView() {
  const { user } = useAuth();
  const [fsRecords, setFsRecords] = useState<IntegrationRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState("All");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const unsub = subscribeToIntegrations(
      user.uid,
      (records) => { setFsRecords(records); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [user]);

  // Merge static metadata with live Firestore status
  const merged: MergedInteg[] = INTEG_META.map((meta) => {
    if (meta.comingSoon) return { ...meta, status: "coming_soon" };
    const record = fsRecords.find((r) => r.id === meta.id);
    if (!record) return { ...meta, status: "disconnected" };
    const status: IntegStatus = record.error ? "error" : record.connected ? "connected" : "disconnected";
    return {
      ...meta,
      status,
      connectedAs: record.connectedAs,
      lastSync:    record.lastSync,
    };
  });

  const connect = async (id: string) => {
    if (!user) return;
    await setIntegrationStatus(user.uid, id, { connected: true, lastSync: new Date().toLocaleTimeString() }).catch(() => {});
  };

  const disconnect = async (id: string) => {
    if (!user) return;
    await setIntegrationStatus(user.uid, id, { connected: false, connectedAs: undefined, lastSync: undefined, error: undefined }).catch(() => {});
  };

  const filtered = merged.filter((i) => {
    const matchesCat    = category === "All" || i.category === category;
    const matchesSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const connectedCount = merged.filter((i) => i.status === "connected").length;

  return (
    <div className="h-full overflow-y-auto bg-background custom-scrollbar">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Integrations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connect your tools to automate your product intelligence workflow
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{connectedCount}</span> connected
            </span>
          </div>
        </div>

        {/* ── Search + filter ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search integrations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  category === cat
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No integrations found</p>
            <p className="text-xs text-muted-foreground">Try a different search term or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((integ) => (
              <IntegrationCard
                key={integ.id}
                integ={integ}
                onConnect={connect}
                onDisconnect={disconnect}
              />
            ))}
          </div>
        )}

        {/* ── Request integration ── */}
        <div className="mt-8 p-4 rounded-xl border border-dashed border-border/60 text-center">
          <p className="text-xs text-muted-foreground">Don&apos;t see the tool you need?</p>
          <button className="mt-1.5 text-xs text-primary font-medium hover:underline flex items-center gap-1 mx-auto">
            Request an integration <ExternalLink className="h-3 w-3" />
          </button>
        </div>

      </div>
    </div>
  );
}
