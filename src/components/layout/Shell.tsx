"use client";

import { useAppStore } from "@/store/useAppStore";
import { Editor } from "@/components/editor/Editor";
import { AIPanel } from "@/components/ai/AIPanel";
import { SidebarNav } from "./SidebarNav";
import { InsightsView } from "@/components/views/InsightsView";
import { PRDsView } from "@/components/views/PRDsView";
import { TasksView } from "@/components/views/TasksView";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { LandingPage } from "./LandingPage";
import { Loader2 } from "lucide-react";

export function Shell() {
  const { user, loading } = useAuth();
  const { aiPanelOpen, activeView } = useAppStore();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#030303]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
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
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar: Fixed width */}
      <div className="w-[240px] shrink-0 xl:w-[260px] bg-sidebar relative z-20 shadow-sm border-r border-border/50">
        <SidebarNav />
      </div>

      {/* Center: Main view */}
      <div className="flex-1 min-w-0 bg-card/30 overflow-hidden">
        {renderMainView()}
      </div>

      {/* Right: AI Panel (editor only) */}
      {showAIPanel && (
        <div className="w-[340px] shrink-0 xl:w-[380px] bg-sidebar border-l border-border relative z-20 shadow-2xl overflow-hidden">
          <AIPanel />
        </div>
      )}
    </div>
  );
}


