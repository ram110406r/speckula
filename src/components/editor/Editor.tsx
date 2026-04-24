"use client";

import React, { useEffect } from "react";
import { TipTapEditor } from "./TipTapEditor";
import { useAppStore } from "@/store/useAppStore";
import { Sparkles, PanelRightOpen, PanelRightClose, CircleDashed, ShieldAlert, FlaskConical, HelpCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDocument } from "@/lib/firebase/db";
import { useAuth } from "@/lib/firebase/AuthProvider";

const STRUCTURE_BLOCKS = [
  { id: "problem", label: "Problem", icon: CircleDashed, starter: "Problem: Who is struggling, what behavior is stuck, and what metric is moving the wrong way?" },
  { id: "hypothesis", label: "Hypothesis", icon: FlaskConical, starter: "Hypothesis: If we change ___ for ___ users, then ___ metric should improve because ___." },
  { id: "constraints", label: "Constraints", icon: ShieldAlert, starter: "Constraints: Timeline, team bandwidth, technical limits, and non-negotiables." },
  { id: "unknowns", label: "Unknowns", icon: HelpCircle, starter: "Unknowns: What assumptions are still unproven and what evidence is still missing?" },
] as const;

export function Editor() {
  const { user } = useAuth();
  const { aiPanelOpen, toggleAiPanel, isSaving, currentDocId, documents, setDocuments, activeContext, setPendingInsertion } = useAppStore();
  const currentDoc = documents.find(d => d.id === currentDocId);

  const normalizedContext = activeContext.toLowerCase();
  const activeSectionId = normalizedContext.includes("hypothesis")
    ? "hypothesis"
    : normalizedContext.includes("constraint")
      ? "constraints"
      : normalizedContext.includes("unknown") || normalizedContext.includes("risk")
        ? "unknowns"
        : "problem";

  const isEmptyCanvas = activeContext.trim().length === 0;

  useEffect(() => {
    if (!user || !currentDocId || !currentDoc) return;

    const normalizedTitle = currentDoc.title.trim() || "Untitled Document";
    if (normalizedTitle === currentDoc.title.trim()) return;

    const handler = setTimeout(async () => {
      try {
        const title = normalizedTitle;
        await saveDocument(user.uid, currentDocId, { title });
        setDocuments(documents.map(d =>
          d.id === currentDocId ? { ...d, title } : d
        ));
      } catch (error) {
        console.error("Failed to save title:", error);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [currentDoc?.title, currentDocId, currentDoc, documents, setDocuments, user]);

  const handleTitleChange = (newTitle: string) => {
    if (!currentDocId) return;

    setDocuments(documents.map(d =>
      d.id === currentDocId ? { ...d, title: newTitle } : d
    ));
  };

  const insertStructuredStarter = (starter: string) => {
    setPendingInsertion(starter);
  };

  return (
    <div className="flex h-full flex-col w-full bg-[#fffefb] selection:bg-primary/10">
      <div className="border-b border-border/70 bg-white/95 px-6 py-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[240px] items-center gap-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-1.5">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="label-system text-[11px]">Structured Canvas</p>
              <p className="text-xs text-muted-foreground">Guide your idea to clarity, decisions, and execution.</p>
            </div>
          </div>

          <div className="flex min-w-[240px] flex-1 items-center gap-4 lg:max-w-[420px]">
            <Input
              value={currentDoc?.title ?? "Untitled Document"}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-border/70 bg-white px-3 text-sm font-semibold"
              placeholder="Document Title..."
            />
            {isSaving && (
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/20 animate-pulse whitespace-nowrap">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                <span className="label-system text-[11px] lowercase">
                  Saving
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 label-system text-[12px] hover:text-primary hover:bg-primary/5 px-2"
              onClick={toggleAiPanel}
            >
              {aiPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              {aiPanelOpen ? "Hide Assistant" : "Show Assistant"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 text-primary hover:bg-primary/8 p-0"
              onClick={toggleAiPanel}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {STRUCTURE_BLOCKS.map((block) => {
            const isActive = activeSectionId === block.id;
            const Icon = block.icon;
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => insertStructuredStarter(block.starter)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${isActive ? "border-primary/40 bg-primary/8 text-primary shadow-sm" : "border-border/70 bg-white text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {block.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative flex-1 overflow-auto p-5 lg:p-8">
        {isEmptyCanvas && (
          <div className="mx-auto mb-5 max-w-4xl rounded-3xl border border-primary/25 bg-[#fcf7ed] p-5 shadow-sm">
            <p className="text-base font-semibold">Start your first product decision.</p>
            <p className="mt-1 text-sm text-muted-foreground">Describe your idea in one sentence.</p>
            <div className="mt-3 rounded-xl border border-border/70 bg-white px-3 py-2 text-sm text-foreground">Help students manage time using AI</div>
            <Button
              type="button"
              className="mt-4 h-9 rounded-xl bg-primary text-white hover:bg-primary/90"
              onClick={() => insertStructuredStarter("Problem: Help students manage time using AI by reducing planning friction and missed deadlines.")}
            >
              Start with this
            </Button>
          </div>
        )}
        <div className="mx-auto max-w-4xl rounded-3xl border border-border/70 bg-white p-6 shadow-[0_8px_26px_rgba(52,46,34,0.08)] lg:p-8">
          <TipTapEditor />
        </div>
      </div>
    </div>
  );
}

