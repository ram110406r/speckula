"use client";

import React, { useState } from "react";
import {
  Search, CheckCircle2, ExternalLink, Settings,
  Zap, AlertCircle, Plus, ChevronRight
} from "lucide-react";

type IntegStatus = "connected" | "disconnected" | "error" | "coming_soon";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegStatus;
  logo: string;
  connectedAs?: string;
  lastSync?: string;
  docsUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "slack",       name: "Slack",        category: "Communication",
    description: "Push signals and decisions to Slack channels. Get notified on important updates.",
    logo: "SL", status: "connected", connectedAs: "#product-intelligence", lastSync: "2m ago",
  },
  {
    id: "github",      name: "GitHub",       category: "Engineering",
    description: "Link tasks to GitHub issues and PRs. Track development progress automatically.",
    logo: "GH", status: "connected", connectedAs: "acme-org/product", lastSync: "5m ago",
  },
  {
    id: "jira",        name: "Jira",         category: "Project Management",
    description: "Sync tasks with Jira tickets. Keep your backlog in sync with your specs.",
    logo: "JI", status: "disconnected",
  },
  {
    id: "notion",      name: "Notion",       category: "Documentation",
    description: "Export specs and decisions to Notion pages. Keep your wiki up to date.",
    logo: "NO", status: "disconnected",
  },
  {
    id: "posthog",     name: "PostHog",      category: "Analytics",
    description: "Import user behavior data as signals. Correlate product decisions with metrics.",
    logo: "PH", status: "connected", connectedAs: "acme-prod", lastSync: "10m ago",
  },
  {
    id: "figma",       name: "Figma",        category: "Design",
    description: "Attach Figma prototypes to specs. Keep design and product in sync.",
    logo: "FI", status: "disconnected",
  },
  {
    id: "mixpanel",    name: "Mixpanel",     category: "Analytics",
    description: "Pull funnel analytics and retention data as evidence for your decisions.",
    logo: "MI", status: "error", connectedAs: "acme-analytics",
  },
  {
    id: "linear",      name: "Linear",       category: "Project Management",
    description: "Sync Speckula tasks with Linear issues. Automate your engineering workflow.",
    logo: "LI", status: "coming_soon",
  },
  {
    id: "hubspot",     name: "HubSpot",      category: "CRM",
    description: "Import customer feedback and sales signals directly into your product brain.",
    logo: "HS", status: "coming_soon",
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(INTEGRATIONS.map((i) => i.category)))];

const LOGO_COLORS: Record<string, string> = {
  SL: "bg-[#4A154B] text-white",
  GH: "bg-[#24292E] text-white",
  JI: "bg-[#0052CC] text-white",
  NO: "bg-[#000000] text-white",
  PH: "bg-[#F54E00] text-white",
  FI: "bg-[#F24E1E] text-white",
  MI: "bg-[#7856FF] text-white",
  LI: "bg-[#5E6AD2] text-white",
  HS: "bg-[#FF7A59] text-white",
};

const STATUS_CONFIG = {
  connected:    { label: "Connected",    color: "text-green-600",   bg: "bg-green-500/10",  icon: CheckCircle2 },
  disconnected: { label: "Disconnected", color: "text-muted-foreground", bg: "bg-muted", icon: Plus          },
  error:        { label: "Error",        color: "text-red-500",     bg: "bg-red-500/10",    icon: AlertCircle  },
  coming_soon:  { label: "Coming soon",  color: "text-muted-foreground", bg: "bg-muted", icon: Zap           },
};

function IntegrationCard({ integ, onConnect, onDisconnect, onSettings }: {
  integ: Integration;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onSettings: (id: string) => void;
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
      {/* Header */}
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

      {/* Connected metadata */}
      {(isConnected || isError) && (
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          {integ.connectedAs && <div>Connected as: <span className="text-foreground font-medium">{integ.connectedAs}</span></div>}
          {integ.lastSync && !isError && <div>Last sync: <span className="text-foreground">{integ.lastSync}</span></div>}
          {isError && <div className="text-red-500">Sync failed — re-authentication required</div>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        {isSoon ? (
          <button disabled className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium opacity-60 cursor-not-allowed">
            Coming soon
          </button>
        ) : isConnected ? (
          <>
            <button
              onClick={() => onSettings(integ.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
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
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [search, setSearch]             = useState("");
  const [category, setCategory]         = useState("All");

  const connect    = (id: string) => setIntegrations((p) => p.map((i) => i.id === id ? { ...i, status: "connected" as const, lastSync: "just now" } : i));
  const disconnect = (id: string) => setIntegrations((p) => p.map((i) => i.id === id ? { ...i, status: "disconnected" as const, connectedAs: undefined, lastSync: undefined } : i));
  const openSettings = (_id: string) => { /* TODO: open settings drawer */ };

  const filtered = integrations.filter((i) => {
    const matchesCat    = category === "All" || i.category === category;
    const matchesSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const connectedCount = integrations.filter((i) => i.status === "connected").length;

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
            <span className="text-muted-foreground"><span className="text-foreground font-medium">{connectedCount}</span> connected</span>
          </div>
        </div>

        {/* ── Search + filter ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
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
        {filtered.length === 0 ? (
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
                onSettings={openSettings}
              />
            ))}
          </div>
        )}

        {/* ── Request integration ── */}
        <div className="mt-8 p-4 rounded-xl border border-dashed border-border/60 text-center">
          <p className="text-xs text-muted-foreground">Don't see the tool you need?</p>
          <button className="mt-1.5 text-xs text-primary font-medium hover:underline flex items-center gap-1 mx-auto">
            Request an integration <ExternalLink className="h-3 w-3" />
          </button>
        </div>

      </div>
    </div>
  );
}
