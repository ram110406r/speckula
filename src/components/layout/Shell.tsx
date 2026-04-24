"use client";

import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { Editor } from "@/components/editor/Editor";
import { AIPanel } from "@/components/ai/AIPanel";
import { SidebarNav } from "./SidebarNav";
import { InsightsView } from "../views/InsightsView";
import { PRDsView } from "../views/PRDsView";
import { TasksView } from "../views/TasksView";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { LandingPage } from "./LandingPage";
import { DecisionView } from "../views/DecisionView";
import { PlatformView } from "../views/PlatformView";
import { Activity, Loader2, Workflow } from "lucide-react";

const STAGES = ["Discovery", "Validation", "Build", "Scale"] as const;

function formatRelativeActivity(value: unknown): string {
  if (!value || typeof value !== "object") return "No recent activity";

  const maybeTimestamp = value as { toDate?: () => Date };
  const date = typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
  if (!date) return "Recently updated";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hr ago`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
}

export function Shell() {
  const { user, loading } = useAuth();
  const { aiPanelOpen, activeView, documents, currentDocId, setCurrentDocId } = useAppStore();
  const [stage, setStage] = React.useState<(typeof STAGES)[number]>("Discovery");

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
          <span className="label-system text-[12px] animate-pulse">Initializing Workspace</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const currentDoc = documents.find((doc) => doc.id === currentDocId);
  const activityText = formatRelativeActivity(currentDoc?.updatedAt);
  const decisionStatus = (currentDocId && activeView === "decisions") || activeView === "prds"
    ? "Decisioning"
    : currentDocId
      ? "Thinking"
      : "Idle";

  const renderMainView = () => {
    switch (activeView) {
      case "insights": return <InsightsView />;
      case "prds": return <PRDsView />;
      case "tasks": return <TasksView />;
      case "decisions": return <DecisionView />;
      case "platform": return <PlatformView />;
      default: return <Editor />;
    }
  };

  // Only show the AI panel when in editor view
  const showAIPanel = aiPanelOpen && activeView === "editor";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden text-foreground selection:bg-primary/10">
      <header className="shrink-0 border-b border-border/70 bg-card/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <div className="min-w-0 flex-1 md:max-w-[320px]">
            <select
              aria-label="Project selector"
              className="h-9 w-full rounded-xl border border-border/70 bg-white px-3 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={currentDocId ?? ""}
              onChange={(event) => setCurrentDocId(event.target.value || null)}
            >
              {documents.length === 0 ? (
                <option value="">No documents yet</option>
              ) : (
                documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="hidden items-center gap-2 rounded-full bg-secondary/70 px-2 py-1 md:flex">
            {STAGES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStage(item)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${stage === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs">
            <div className="hidden items-center gap-1.5 rounded-lg border border-border/70 bg-white px-2.5 py-1.5 sm:flex">
              <Workflow className="h-3.5 w-3.5 text-primary" />
              <span className="label-system text-[11px] normal-case">{decisionStatus}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-white px-2.5 py-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="label-system text-[11px] normal-case">{activityText}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)_360px]">
        <div className="hidden min-h-0 border-r border-border/70 bg-[#e8e2d3] md:block">
          <SidebarNav />
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden bg-[#fffefb]">
          {renderMainView()}
        </div>

        {showAIPanel && (
          <div className="hidden min-h-0 border-l border-border/70 bg-[#f6f1e6] lg:block">
            <AIPanel />
          </div>
        )}
      </div>
    </div>
  );
}


