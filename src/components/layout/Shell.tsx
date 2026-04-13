"use client";

import { useAppStore } from "@/store/useAppStore";
import { Editor } from "@/components/editor/Editor";
import { AIPanel } from "@/components/ai/AIPanel";
import { SidebarNav } from "./SidebarNav";
import { InsightsView } from "../views/InsightsView";
import { PRDsView } from "../views/PRDsView";
import { TasksView } from "../views/TasksView";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { LandingPage } from "./LandingPage";
import { Loader2 } from "lucide-react";

export function Shell() {
  const { user, loading } = useAuth();
  const { aiPanelOpen, activeView } = useAppStore();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 animate-pulse">Initializing Workspace</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const renderMainView = () => {
    switch (activeView) {
      case "insights": return <InsightsView />;
      case "prds": return <PRDsView />;
      case "tasks": return <TasksView />;
      default: return <Editor />;
    }
  };

  // Only show the AI panel when in editor view
  const showAIPanel = aiPanelOpen && activeView === "editor";

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden selection:bg-primary/10">
      {/* Sidebar: Fixed width */}
      <div className="w-[240px] shrink-0 xl:w-[260px] bg-background relative z-20 border-r border-border/60">
        <SidebarNav />
      </div>

      {/* Center: Main view */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {renderMainView()}
      </div>

      {/* Right: AI Panel (editor only) */}
      {showAIPanel && (
        <div className="w-[340px] shrink-0 xl:w-[380px] bg-background border-l border-border/60 relative z-20 overflow-hidden animate-in slide-in-from-right duration-500 ease-out">
          <AIPanel />
        </div>
      )}
    </div>
  );
}


