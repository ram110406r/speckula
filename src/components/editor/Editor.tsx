"use client";

import React from "react";
import {
  Sparkles, Loader2, AlertTriangle, Lightbulb, TrendingUp,
  CheckCircle2, Brain, Link2, X, ChevronDown, ChevronUp,
  RotateCcw, Minus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { saveDocument, getDocument } from "@/lib/firebase/db";
import { URLImportBar } from "./URLImportBar";
import {
  analyzeResearchAction,
  getBlockSuggestion,
  type ResearchAnalysis,
} from "@/lib/ai/actions";
import { toast } from "@/store/useToastStore";
import { activity } from "@/store/useActivityStore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResearchBlocks {
  problem: string;
  context: string;
  userPain: string;
  insights: string;
  assumptions: string;
}

interface SelectionState {
  text: string;
  x: number;
  y: number;
}

const EMPTY_BLOCKS: ResearchBlocks = {
  problem: "", context: "", userPain: "", insights: "", assumptions: "",
};

const BLOCK_DEFS: {
  key: keyof ResearchBlocks;
  label: string;
  placeholder: string;
  hint: string;
}[] = [
  {
    key: "problem",
    label: "Problem",
    placeholder: "Who is struggling, with what, and what metric is moving the wrong way?",
    hint: "Define the core problem with specificity — user, behavior, and measurable impact.",
  },
  {
    key: "context",
    label: "Context",
    placeholder: "What is the market landscape? What solutions exist today? What triggers this problem?",
    hint: "Background and surrounding conditions that shape the problem space.",
  },
  {
    key: "userPain",
    label: "User Pain",
    placeholder: "What specific frustrations are users experiencing? What workarounds do they use?",
    hint: "The friction, emotions, and workarounds users deal with today.",
  },
  {
    key: "insights",
    label: "Insights",
    placeholder: "What patterns did research reveal? What data supports this? What surprised you?",
    hint: "Evidence, patterns, and findings from user research or analytics.",
  },
  {
    key: "assumptions",
    label: "Assumptions",
    placeholder: "What must be true for this to work? What are you assuming but haven't proven yet?",
    hint: "Risky beliefs baked into your thinking that still need validation.",
  },
];

// ── Content serialization ─────────────────────────────────────────────────────

const RESEARCH_TYPE = "research_blocks_v1";

function serializeBlocks(blocks: ResearchBlocks): object {
  return { _type: RESEARCH_TYPE, ...blocks };
}

function parseContent(raw: unknown): ResearchBlocks {
  if (!raw || typeof raw !== "object") return EMPTY_BLOCKS;
  const obj = raw as Record<string, unknown>;
  if (obj._type === RESEARCH_TYPE) {
    return {
      problem:     typeof obj.problem     === "string" ? obj.problem     : "",
      context:     typeof obj.context     === "string" ? obj.context     : "",
      userPain:    typeof obj.userPain    === "string" ? obj.userPain    : "",
      insights:    typeof obj.insights    === "string" ? obj.insights    : "",
      assumptions: typeof obj.assumptions === "string" ? obj.assumptions : "",
    };
  }
  // Legacy TipTap JSON — extract text into problem block
  return { ...EMPTY_BLOCKS, problem: extractTipTapText(raw) };
}

function extractTipTapText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) return (n.content as unknown[]).map(extractTipTapText).join(" ");
  return "";
}

// ── Health score ──────────────────────────────────────────────────────────────

function computeHealth(blocks: ResearchBlocks) {
  const vals = Object.values(blocks);
  const filled = vals.filter((v) => v.trim().length > 30).length;
  const completeness = Math.round((filled / 5) * 100);

  const allText = vals.join(" ");
  const sentences = allText.split(/[.!?]+/).filter((s) => s.trim().split(/\s+/).length > 2);
  const avgLen = sentences.length
    ? sentences.reduce((s, c) => s + c.trim().split(/\s+/).length, 0) / sentences.length
    : 0;
  const clarity = avgLen === 0 ? 0 : Math.max(20, Math.min(100, Math.round(100 - Math.abs(avgLen - 12) * 2.5)));

  const riskRe = /\b(assum|uncertain|unclear|unknown|might|maybe|not sure|could be|believe|think)\b/gi;
  const riskCount = (allText.match(riskRe) ?? []).length;
  const risk = Math.min(100, Math.round(riskCount * 10));

  const overall = Math.round(completeness * 0.55 + clarity * 0.25 + Math.max(0, 100 - risk * 1.5) * 0.2);
  return { overall, completeness, clarity, risk };
}

// ── Main component ────────────────────────────────────────────────────────────

export function Editor() {
  const { user } = useAuth();
  const {
    currentDocId, documents, setDocuments, isSaving,
    setActiveContext, pendingImport, setPendingImport,
  } = useAppStore();
  const currentDoc = documents.find((d) => d.id === currentDocId);

  const [blocks, setBlocks] = React.useState<ResearchBlocks>(EMPTY_BLOCKS);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showURLImport, setShowURLImport] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<ResearchAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [blockHints, setBlockHints] = React.useState<Partial<Record<keyof ResearchBlocks, string>>>({});
  const [hintLoading, setHintLoading] = React.useState<keyof ResearchBlocks | null>(null);
  const [selection, setSelection] = React.useState<SelectionState | null>(null);

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedDocIdRef = React.useRef<string | null>(null);
  const titleSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitleRef = React.useRef<{ docId: string | null; title: string }>({ docId: null, title: "" });

  // ── Load document content ─────────────────────────────────────────────────

  React.useEffect(() => {
    if (!user || !currentDocId || loadedDocIdRef.current === currentDocId) return;
    loadedDocIdRef.current = currentDocId;
    setIsLoading(true);
    setBlocks(EMPTY_BLOCKS);
    setAnalysis(null);
    setBlockHints({});
    getDocument(user.uid, currentDocId)
      .then((doc) => {
        if (loadedDocIdRef.current === currentDocId) setBlocks(parseContent(doc?.content));
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [user, currentDocId]);

  // ── Sync active context for AIPanel / other views ─────────────────────────

  React.useEffect(() => {
    const combined = Object.values(blocks).filter(Boolean).join("\n\n");
    setActiveContext(combined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  // ── Debounced content save ────────────────────────────────────────────────

  const scheduleContentSave = React.useCallback(
    (docId: string, b: ResearchBlocks) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        if (!user) return;
        try {
          await saveDocument(user.uid, docId, { content: serializeBlocks(b) });
        } catch {
          toast.error("Failed to save research");
        }
      }, 1500);
    },
    [user]
  );

  const updateBlock = React.useCallback(
    (key: keyof ResearchBlocks, value: string) => {
      if (!currentDocId) return;
      setBlocks((prev) => {
        const next = { ...prev, [key]: value };
        scheduleContentSave(currentDocId, next);
        return next;
      });
      setBlockHints((prev) => ({ ...prev, [key]: undefined }));
    },
    [currentDocId, scheduleContentSave]
  );

  // ── Debounced title save ──────────────────────────────────────────────────

  React.useEffect(() => {
    if (!user || !currentDocId || !currentDoc) return;
    const desiredTitle = currentDoc.title.trim() || "Untitled Document";
    if (lastSavedTitleRef.current.docId !== currentDocId) {
      lastSavedTitleRef.current = { docId: currentDocId, title: desiredTitle };
      return;
    }
    if (desiredTitle === lastSavedTitleRef.current.title) return;
    if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    titleSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveDocument(user.uid, currentDocId, { title: desiredTitle });
        lastSavedTitleRef.current = { docId: currentDocId, title: desiredTitle };
      } catch (e) { console.error("Failed to save title:", e); }
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDoc?.title, currentDocId]);

  // ── Handle pending URL import → Problem block ─────────────────────────────

  React.useEffect(() => {
    if (!pendingImport) return;
    updateBlock("problem", (blocks.problem ? blocks.problem + "\n\n" : "") + pendingImport.text);
    setPendingImport(null);
    toast.info("Content imported into Problem block");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingImport]);

  // ── Text selection popup ──────────────────────────────────────────────────

  const handleMouseUp = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't trigger on clicks inside the selection popup itself
    if ((e.target as HTMLElement).closest("[data-selection-popup]")) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelection({ text: sel.toString().trim(), x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  // ── Block AI hint ─────────────────────────────────────────────────────────

  const requestBlockHint = React.useCallback(async (key: keyof ResearchBlocks) => {
    if (!user || hintLoading || !blocks[key]) return;
    setHintLoading(key);
    const other = BLOCK_DEFS
      .filter((b) => b.key !== key)
      .map((b) => blocks[b.key])
      .filter(Boolean)
      .join(" ");
    const hint = await getBlockSuggestion(
      user.uid,
      BLOCK_DEFS.find((b) => b.key === key)!.label,
      blocks[key],
      other
    );
    setBlockHints((prev) => ({ ...prev, [key]: hint ?? undefined }));
    setHintLoading(null);
  }, [user, blocks, hintLoading]);

  // ── Insight Engine analysis ───────────────────────────────────────────────

  const handleAnalyze = React.useCallback(async () => {
    if (!user || isAnalyzing) return;
    if (!Object.values(blocks).some((v) => v.trim().length > 20)) {
      toast.warning("Add some research content first");
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await analyzeResearchAction(user.uid, blocks as unknown as Record<string, string>);
      setAnalysis(result);
      activity.ai("Research analyzed");
    } catch {
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [user, blocks, isAnalyzing]);

  const handleTitleChange = (title: string) => {
    if (!currentDocId) return;
    setDocuments(documents.map((d) => (d.id === currentDocId ? { ...d, title } : d)));
  };

  const health = computeHealth(blocks);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-background" onMouseUp={handleMouseUp}>

      {/* ── Top bar ── */}
      <div className="border-b border-border bg-card px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Input
            value={currentDoc?.title ?? "Untitled Document"}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-9 flex-1 max-w-[480px] rounded-md border-border/70 bg-transparent px-2 text-sm font-medium focus-visible:bg-background"
            placeholder="Document title"
          />
          {isSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
          <div className="ml-auto">
            <button
              onClick={() => setShowURLImport((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border transition-all ${
                showURLImport
                  ? "border-primary/40 bg-primary/[0.07] text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Link2 className="h-3 w-3" /> Import URL
            </button>
          </div>
        </div>
      </div>

      <URLImportBar
        visible={showURLImport}
        onImport={(text, title) => {
          setPendingImport({ text, title: title ?? null });
          setShowURLImport(false);
        }}
        onDismiss={() => setShowURLImport(false)}
      />

      {/* ── Health Score bar ── */}
      <HealthScoreBar health={health} />

      {/* ── Main body ── */}
      <div className="flex-1 overflow-hidden flex">

        {/* Center: structured blocks */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground/50">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-mono text-[11px] uppercase tracking-widest">Loading…</span>
            </div>
          ) : (
            BLOCK_DEFS.map((def) => (
              <ResearchBlock
                key={def.key}
                def={def}
                value={blocks[def.key]}
                onChange={(v) => updateBlock(def.key, v)}
                hint={blockHints[def.key] ?? null as string | null}
                hintLoading={hintLoading === def.key}
                onRequestHint={() => requestBlockHint(def.key)}
                onApplyHint={() => {
                  const h = blockHints[def.key];
                  if (h) {
                    updateBlock(def.key, blocks[def.key] ? `${blocks[def.key]}\n\n${h}` : h);
                    setBlockHints((prev) => ({ ...prev, [def.key]: undefined }));
                  }
                }}
                onIgnoreHint={() => setBlockHints((prev) => ({ ...prev, [def.key]: undefined }))}
              />
            ))
          )}
        </div>

        {/* Right: Insight Engine */}
        <aside className="w-[300px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
          <InsightEngine
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
            blocksEmpty={!Object.values(blocks).some((v) => v.trim().length > 20)}
          />
        </aside>
      </div>

      {/* ── Selection popup ── */}
      {selection && (
        <SelectionPopup
          selection={selection}
          blocks={blocks}
          onBlockUpdate={updateBlock}
          onClose={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
        />
      )}
    </div>
  );
}

// ── HealthScoreBar ────────────────────────────────────────────────────────────

function scoreColor(v: number, invert = false) {
  const n = invert ? 100 - v : v;
  return n >= 65 ? "bg-emerald-500" : n >= 35 ? "bg-amber-400" : "bg-rose-400";
}

function HealthScoreBar({ health }: { health: ReturnType<typeof computeHealth> }) {
  return (
    <div className="px-6 py-2.5 bg-card border-b border-border shrink-0">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <span className={`font-mono text-xl font-bold tabular-nums leading-none ${
            health.overall >= 65 ? "text-emerald-600" : health.overall >= 35 ? "text-amber-500" : "text-rose-500"
          }`}>
            {health.overall}
          </span>
          <div className="leading-tight">
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50">Research</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/50">Score</div>
          </div>
        </div>
        <div className="w-px h-5 bg-border shrink-0" />
        <div className="flex gap-4 flex-1 min-w-0">
          {[
            { label: "Completeness", value: health.completeness, invert: false },
            { label: "Clarity",      value: health.clarity,      invert: false },
            { label: "Risk",         value: health.risk,         invert: true  },
          ].map(({ label, value, invert }) => (
            <div key={label} className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/55">{label}</span>
                <span className="font-mono text-[10px] tabular-nums text-foreground/60">{value}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${scoreColor(value, invert)}`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ResearchBlock ─────────────────────────────────────────────────────────────

interface ResearchBlockProps {
  def: (typeof BLOCK_DEFS)[number];
  value: string;
  onChange: (v: string) => void;
  hint: string | null;
  hintLoading: boolean;
  onRequestHint: () => void;
  onApplyHint: () => void;
  onIgnoreHint: () => void;
}

function ResearchBlock({ def, value, onChange, hint, hintLoading, onRequestHint, onApplyHint, onIgnoreHint }: ResearchBlockProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(96, el.scrollHeight)}px`;
  }, [value]);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const isEmpty = value.trim().length < 30;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-border/80 transition-all duration-200 overflow-hidden group">

      {/* Block header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-border/50 bg-slate-50/60 dark:bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground">
            {def.label}
          </span>
          {!isEmpty && (
            <span className="font-mono text-[9px] text-muted-foreground/40 tabular-nums">{wordCount}w</span>
          )}
        </div>
        <button
          onClick={onRequestHint}
          disabled={hintLoading || isEmpty}
          title={`Get AI suggestion for ${def.label}`}
          className="flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] text-muted-foreground/50 hover:text-primary hover:bg-primary/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
        >
          {hintLoading
            ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
            : <Sparkles className="h-2.5 w-2.5" />
          }
          Suggest
        </button>
      </div>

      {/* Textarea */}
      <div className="px-4 py-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
          className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
          style={{ minHeight: 96 }}
        />
      </div>

      {/* AI hint card */}
      {hint && (
        <div className="mx-4 mb-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2.5">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-foreground/80 leading-relaxed">{hint}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onApplyHint}
              className="flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-all"
            >
              <CheckCircle2 className="h-2.5 w-2.5" /> Apply
            </button>
            <button
              onClick={onIgnoreHint}
              className="flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-muted transition-all"
            >
              <X className="h-2.5 w-2.5" /> Ignore
            </button>
          </div>
        </div>
      )}

      {/* Empty state helper text */}
      {isEmpty && !hint && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-muted-foreground/35 leading-relaxed">{def.hint}</p>
        </div>
      )}
    </div>
  );
}

// ── InsightEngine ─────────────────────────────────────────────────────────────

interface InsightEngineProps {
  analysis: ResearchAnalysis | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  blocksEmpty: boolean;
}

const ENGINE_SECTIONS: {
  key: keyof ResearchAnalysis;
  label: string;
  icon: React.ElementType;
  cls: string;
  border: string;
  bg: string;
}[] = [
  { key: "summary",       label: "Summary",             icon: Brain,         cls: "text-primary",     border: "border-primary/20",   bg: "bg-primary/[0.04]"                          },
  { key: "risks",         label: "Risks",               icon: AlertTriangle, cls: "text-amber-600",   border: "border-amber-200",    bg: "bg-amber-50 dark:bg-amber-950/20"           },
  { key: "opportunities", label: "Opportunities",       icon: TrendingUp,    cls: "text-emerald-600", border: "border-emerald-200",  bg: "bg-emerald-50 dark:bg-emerald-950/20"       },
  { key: "missingInfo",   label: "Missing Information", icon: Lightbulb,     cls: "text-blue-500",    border: "border-blue-200",     bg: "bg-blue-50 dark:bg-blue-950/20"             },
];

function InsightEngine({ analysis, isAnalyzing, onAnalyze, blocksEmpty }: InsightEngineProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-foreground/70">
              Insight Engine
            </span>
          </div>
          {analysis && (
            <button
              onClick={() => { setCollapsed(new Set()); }}
              title="Expand all"
              className="text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || blocksEmpty}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-[11px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isAnalyzing
            ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing…</>
            : <><Sparkles className="h-3 w-3" /> Analyze Research</>
          }
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar">
        {!analysis && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
            <div className="h-10 w-10 rounded-xl border border-border flex items-center justify-center mb-3">
              <Brain className="h-5 w-5 text-muted-foreground/25" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/45 mb-1.5">Engine idle</p>
            <p className="text-[11px] text-muted-foreground/35 leading-relaxed">
              Fill in your research blocks, then click Analyze Research to surface insights.
            </p>
          </div>
        )}

        {isAnalyzing && (
          <div className="space-y-2 pt-1">
            {ENGINE_SECTIONS.map((s) => (
              <div key={s.key} className="rounded-lg border border-border/40 p-3 space-y-2 animate-pulse">
                <div className="h-2 rounded-full bg-muted/60 w-20" />
                <div className="h-2 rounded-full bg-muted/40 w-full" />
                <div className="h-2 rounded-full bg-muted/30 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {analysis && !isAnalyzing && ENGINE_SECTIONS.map((sec) => {
          const val = analysis[sec.key];
          const Icon = sec.icon;
          const isOpen = !collapsed.has(sec.key);
          const hasContent = Array.isArray(val) ? val.length > 0 : !!val;
          if (!hasContent) return null;

          return (
            <div key={sec.key} className={`rounded-lg border ${sec.border} ${sec.bg} overflow-hidden`}>
              <button
                onClick={() => toggle(sec.key)}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-3 w-3 ${sec.cls}`} />
                  <span className={`font-mono text-[10px] uppercase tracking-[0.08em] font-semibold ${sec.cls}`}>
                    {sec.label}
                  </span>
                  {Array.isArray(val) && (
                    <span className="font-mono text-[9px] text-muted-foreground/45">({val.length})</span>
                  )}
                </div>
                {isOpen
                  ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" />
                  : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                }
              </button>
              {isOpen && (
                <div className="px-3 pb-3">
                  {typeof val === "string" ? (
                    <p className="text-[11px] text-foreground/80 leading-relaxed">{val}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {(val as string[]).map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-foreground/80 leading-relaxed">
                          <Minus className="h-2.5 w-2.5 mt-0.5 shrink-0 text-muted-foreground/35" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SelectionPopup ────────────────────────────────────────────────────────────

const SELECTION_ACTIONS = [
  { id: "hypothesis", label: "Generate Hypothesis", desc: "Frame as IF/THEN hypothesis → Assumptions" },
  { id: "risk",       label: "Identify Risk",       desc: "Flag as risk entry → Assumptions"          },
  { id: "decision",   label: "Convert to Decision", desc: "Mark as decision needed → Insights"        },
] as const;

function SelectionPopup({
  selection,
  blocks,
  onBlockUpdate,
  onClose,
}: {
  selection: SelectionState;
  blocks: ResearchBlocks;
  onBlockUpdate: (key: keyof ResearchBlocks, v: string) => void;
  onClose: () => void;
}) {
  const apply = (id: string) => {
    const t = selection.text;
    if (id === "hypothesis") {
      const entry = `Hypothesis: If ${t.charAt(0).toLowerCase() + t.slice(1)}, then [expected outcome].`;
      onBlockUpdate("assumptions", blocks.assumptions ? `${blocks.assumptions}\n\n${entry}` : entry);
      toast.success("Added as hypothesis to Assumptions");
    } else if (id === "risk") {
      const entry = `⚠️ Risk: ${t}`;
      onBlockUpdate("assumptions", blocks.assumptions ? `${blocks.assumptions}\n\n${entry}` : entry);
      toast.success("Flagged as risk in Assumptions");
    } else if (id === "decision") {
      const entry = `→ Decision needed: ${t}`;
      onBlockUpdate("insights", blocks.insights ? `${blocks.insights}\n\n${entry}` : entry);
      toast.info("Added to Insights");
    }
    onClose();
  };

  return (
    <div
      data-selection-popup
      className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-[220px]"
      style={{ left: Math.max(8, selection.x - 110), top: Math.max(8, selection.y - 10), transform: "translateY(-100%)" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-border/60 bg-muted/30">
        <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60 mb-0.5">Selected</p>
        <p className="text-[11px] text-foreground/75 max-w-[200px] truncate">&quot;{selection.text}&quot;</p>
      </div>
      <div className="p-1">
        {SELECTION_ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => apply(action.id)}
            className="w-full flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
          >
            <span className="font-mono text-[11px] font-medium text-foreground">{action.label}</span>
            <span className="text-[10px] text-muted-foreground/55 leading-snug">{action.desc}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-muted-foreground/35 hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
