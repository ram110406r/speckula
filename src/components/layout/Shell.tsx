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
import { SlackView } from "../views/SlackView";
import { AutonomousModeView } from "../views/AutonomousModeView";
import { Loader2 } from "lucide-react";

function formatRelativeActivity(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const maybeTimestamp = value as { toDate?: () => Date };
  const date = typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
  if (!date) return null;

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `Updated ${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `Updated ${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  return `Updated ${diffDay}d ago`;
}

export function Shell() {
  const { user, loading } = useAuth();
  const { aiPanelOpen, activeView, documents, currentDocId } = useAppStore();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspace
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const currentDoc = documents.find((doc) => doc.id === currentDocId);
  const activityText = formatRelativeActivity(currentDoc?.updatedAt);

  const phaseLabel = (() => {
    if (activeView === "editor" || activeView === "insights") return "Evidence";
    if (activeView === "decisions") return "Argument";
    if (activeView === "prds" || activeView === "tasks") return "Verdict";
    return null;
  })();

  const renderMainView = () => {
    switch (activeView) {
      case "insights": return <InsightsView />;
      case "prds": return <PRDsView />;
      case "tasks": return <TasksView />;
      case "decisions": return <DecisionView />;
      case "platform": return <PlatformView />;
      case "slack": return <SlackView />;
      case "autonomous": return <AutonomousModeView />;
      default: return <Editor />;
    }
  };

  const showAIPanel = aiPanelOpen && activeView === "editor";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden text-foreground selection:bg-primary/10">
      <header className="shrink-0 border-b border-border/70 bg-card/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {currentDoc?.title || (documents.length === 0 ? "No document selected" : "Untitled Document")}
            </p>
          </div>

          {phaseLabel && (
            <span className="hidden sm:inline rounded border border-primary/30 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-primary/70">
              {phaseLabel}
            </span>
          )}

          {activityText && (
            <span className="hidden sm:inline text-xs text-muted-foreground">{activityText}</span>
          )}
        </div>
      </header>

      <div
        className={
          showAIPanel
            ? "grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)_360px]"
            : "grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)]"
        }
      >
        <div className="hidden min-h-0 border-r border-border/70 bg-sidebar md:block">
          <SidebarNav />
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden bg-card">
          {renderMainView()}
        </div>

        {showAIPanel && (
          <div className="hidden min-h-0 border-l border-border/70 bg-muted/40 lg:block">
            <AIPanel />
          </div>
        )}
      </div>
    </div>
  );
}
