"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useAppStore } from "@/store/useAppStore";
import { Editor } from "@/components/editor/Editor";
import { AIPanel } from "@/components/ai/AIPanel";
import { SidebarNav } from "./SidebarNav";

export function Shell() {
  const { aiPanelOpen } = useAppStore();

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-screen max-h-screen bg-background text-foreground overflow-hidden">
      <ResizablePanel defaultSize={15} minSize={10} maxSize={20}>
        <SidebarNav />
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={aiPanelOpen ? 55 : 85} className="bg-card">
        <Editor />
      </ResizablePanel>
      
      {aiPanelOpen && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40} className="border-l border-border">
            <AIPanel />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
