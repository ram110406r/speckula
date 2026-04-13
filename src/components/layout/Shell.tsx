"use client";

import { useAppStore } from "@/store/useAppStore";
import { Editor } from "@/components/editor/Editor";
import { AIPanel } from "@/components/ai/AIPanel";
import { SidebarNav } from "./SidebarNav";
import { InsightsView } from "@/components/views/InsightsView";
import { PRDsView } from "@/components/views/PRDsView";
import { TasksView } from "@/components/views/TasksView";

export function Shell() {
  const { aiPanelOpen, activeView } = useAppStore();

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
      <div className="w-[240px] shrink-0 xl:w-[260px] bg-sidebar relative z-20 shadow-sm">
        <SidebarNav />
      </div>

      {/* Center: Main view */}
      <div className="flex-1 min-w-0 bg-card overflow-hidden">
        {renderMainView()}
      </div>

      {/* Right: AI Panel (editor only) */}
      {showAIPanel && (
        <div className="w-[340px] shrink-0 xl:w-[380px] bg-sidebar border-l border-border relative z-20 shadow-xl overflow-hidden">
          <AIPanel />
        </div>
      )}
    </div>
  );
}

