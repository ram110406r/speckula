"use client";

import React from "react";
import {
  Sparkles, Loader2, AlertTriangle, Lightbulb, TrendingUp,
  CheckCircle2, Brain, Link2, X, ChevronDown, ChevronUp,
  RotateCcw, Minus, Copy, FileText, ChevronRight,
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

type BlockCompletion = "empty" | "partial" | "complete";

const EMPTY_BLOCKS: ResearchBlocks = {
  problem: "", context: "", userPain: "", insights: "", assumptions: "",
};

// Word-count targets per block — soft goals shown in the UI
const WORD_TARGETS: Record<keyof ResearchBlocks, number> = {
  problem: 50, context: 70, userPain: 50, insights: 70, assumptions: 50,
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

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: { id: string; label: string; emoji: string; desc: string; blocks: ResearchBlocks }[] = [
  {
    id: "b2b",
    label: "B2B SaaS",
    emoji: "🏢",
    desc: "Enterprise software with sales-led growth",
    blocks: {
      problem: "Enterprise teams managing [process] face inefficiencies because [root cause]. This leads to [measurable impact] — e.g., X hours/week wasted or Y% slower cycle times.",
      context: "[Market segment] is a $Xbn market. Current solutions include [competitor A] and [competitor B], but they fall short at [specific gap]. The problem surfaces most acutely when [trigger event].",
      userPain: "Users — typically [role] — spend [time] on [workaround] every [frequency]. Common frustrations: 'I can't see X in one place', 'I have to manually sync Y', 'The approval flow takes days.' Main workaround: spreadsheets / Slack threads.",
      insights: "- [X]% of interviewed customers cited [pain] as a top-3 frustration\n- Average team loses [Y hrs/week] to manual [process]\n- NPS for current solution: [score]\n- [Data point from analytics or customer research]",
      assumptions: "- Decision makers will pay $X/seat/month for a solution\n- IT/security approval won't block adoption\n- Existing workflow can be migrated without a full rip-and-replace\n- An internal champion can drive rollout without heavy vendor support",
    },
  },
  {
    id: "consumer",
    label: "Consumer App",
    emoji: "📱",
    desc: "Mobile or web app for end users",
    blocks: {
      problem: "People who [behavior/goal] struggle to [specific problem] because [root cause]. This results in [measurable outcome — abandoned sessions, churn, negative reviews].",
      context: "The [category] app market has [growth/size]. Top players: [App A], [App B]. Users currently cobble together [tools]. The problem is most acute when [trigger — commuting, planning, social moment].",
      userPain: "Users feel [emotion — frustrated, overwhelmed, embarrassed] when [situation]. Typical workarounds: switching between [X] apps, keeping notes in [Y], asking friends via [Z]. Quote from user interview: '[direct quote]'.",
      insights: "- [X]% of surveyed users do [workaround] at least [frequency]\n- Session recordings show [Y]% of users drop off at [step]\n- Top App Store complaint theme: '[theme from reviews]'\n- Retention at D7: [%], D30: [%]",
      assumptions: "- Users will form a daily habit within [X] days\n- Push notifications won't be disabled by most users\n- Viral / referral loop will activate organically\n- [Monetization model] will convert at [X]%",
    },
  },
  {
    id: "internal",
    label: "Internal Tool",
    emoji: "🔧",
    desc: "Tool built for your own team or ops",
    blocks: {
      problem: "[Team/department] can't [action] efficiently because [system gap]. This causes [downstream impact] — e.g., ops team spends X hrs/week on manual exports.",
      context: "Currently [team] uses [tool A + tool B + spreadsheet]. The tools don't communicate. The problem is worst during [process — month-end, onboarding, incident response].",
      userPain: "The [role] has to [tedious task] every [frequency]. Errors occur because [reason]. Time lost: ~[estimate]. The team has raised this pain [X] times in all-hands / Slack.",
      insights: "- Process takes avg. [X min] per occurrence, happens [Y times/week]\n- [Z]% error rate on manual step identified via [audit/log]\n- [Team member] documented the pain in [doc link]\n- Engineering estimate for fix: [X days]",
      assumptions: "- Team will adopt the new tool without heavy training\n- Existing data can be migrated without loss\n- The fix won't create new dependencies on [system]\n- ROI justifies engineering investment at current team scale",
    },
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
  return { ...EMPTY_BLOCKS, problem: extractTipTapText(raw) };
}

function extractTipTapText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) return (n.content as unknown[]).map(extractTipTapText).join(" ");
  return "";
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")  // bold
    .replace(/\*(.*?)\*/g, "$1")       // italic
    .replace(/^#{1,6}\s+/gm, "")      // headings
    .replace(/^[-*]\s+/gm, "• ")      // unordered lists
    .replace(/`([^`]+)`/g, "$1");     // inline code
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getBlockCompletion(value: string, target: number): BlockCompletion {
  const wc = wordCount(value);
  if (wc < 5) return "empty";
  if (wc < target) return "partial";
  return "complete";
}

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

function formatSaveLabel(savedAt: Date | null): string {
  if (!savedAt) return "";
  const s = Math.round((Date.now() - savedAt.getTime()) / 1000);
  if (s < 10) return "Saved just now";
  if (s < 60) return `Saved ${s}s ago`;
  return `Saved ${Math.floor(s / 60)}m ago`;
}

// ── Main component ────────────────────────────────────────────────────────────

export function Editor() {
  const { user } = useAuth();
  const {
    currentDocId, documents, setDocuments,
    setActiveContext, pendingImport, setPendingImport,
  } = useAppStore();
  const currentDoc = documents.find((d) => d.id === currentDocId);

  // ── existing state ──
  const [blocks, setBlocks] = React.useState<ResearchBlocks>(EMPTY_BLOCKS);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showURLImport, setShowURLImport] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<ResearchAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [blockHints, setBlockHints] = React.useState<Partial<Record<keyof ResearchBlocks, string>>>({});
  const [hintLoading, setHintLoading] = React.useState<keyof ResearchBlocks | null>(null);
  const [selection, setSelection] = React.useState<SelectionState | null>(null);

  // ── new state ──
  const [collapsedBlocks, setCollapsedBlocks] = React.useState<Set<keyof ResearchBlocks>>(new Set());
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const [saveLabel, setSaveLabel] = React.useState("");
  const [showMobileInsights, setShowMobileInsights] = React.useState(false);
  const [activeNavBlock, setActiveNavBlock] = React.useState<keyof ResearchBlocks | null>(null);
  const [dismissedEmptyState, setDismissedEmptyState] = React.useState(false);

  // ── refs ──
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedDocIdRef = React.useRef<string | null>(null);
  const titleSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitleRef = React.useRef<{ docId: string | null; title: string }>({ docId: null, title: "" });
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // ── derived ──
  const blocksEmpty = !Object.values(blocks).some((v) => v.trim().length > 10);
  const showEmptyState = !isLoading && blocksEmpty && !!currentDocId && !dismissedEmptyState;

  // ── Load document ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!user || !currentDocId || loadedDocIdRef.current === currentDocId) return;
    loadedDocIdRef.current = currentDocId;
    setIsLoading(true);
    setBlocks(EMPTY_BLOCKS);
    setAnalysis(null);
    setBlockHints({});
    setCollapsedBlocks(new Set());
    setLastSavedAt(null);
    setSaveStatus("idle");
    setSaveLabel("");
    setDismissedEmptyState(false);
    getDocument(user.uid, currentDocId)
      .then((doc) => {
        if (loadedDocIdRef.current === currentDocId) setBlocks(parseContent(doc?.content));
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [user, currentDocId]);

  // ── Sync active context ───────────────────────────────────────────────────

  React.useEffect(() => {
    const combined = Object.values(blocks).filter(Boolean).join("\n\n");
    setActiveContext(combined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  // ── Auto-save timestamp ticker ────────────────────────────────────────────

  React.useEffect(() => {
    if (!lastSavedAt) return;
    setSaveLabel(formatSaveLabel(lastSavedAt));
    const id = setInterval(() => setSaveLabel(formatSaveLabel(lastSavedAt)), 5000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  // ── Debounced content save ────────────────────────────────────────────────

  const scheduleContentSave = React.useCallback(
    (docId: string, b: ResearchBlocks) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus("saving");
      saveTimerRef.current = setTimeout(async () => {
        if (!user) return;
        try {
          await saveDocument(user.uid, docId, { content: serializeBlocks(b) });
          setLastSavedAt(new Date());
          setSaveStatus("saved");
        } catch {
          toast.error("Failed to save research");
          setSaveStatus("idle");
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

  // ── Pending URL import ────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!pendingImport) return;
    updateBlock("problem", (blocks.problem ? blocks.problem + "\n\n" : "") + pendingImport.text);
    setPendingImport(null);
    toast.info("Content imported into Problem block");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingImport]);

  // ── Block navigation via IntersectionObserver ─────────────────────────────

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoading) return;
    const observers: IntersectionObserver[] = [];
    BLOCK_DEFS.forEach((def) => {
      const el = document.getElementById(`block-${def.key}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveNavBlock(def.key); },
        { root: container, threshold: 0.35 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [isLoading, collapsedBlocks]);

  // ── Text selection popup ──────────────────────────────────────────────────

  const handleMouseUp = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-selection-popup]")) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { setSelection(null); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelection({ text: sel.toString().trim(), x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  // ── Block AI hint ─────────────────────────────────────────────────────────

  const requestBlockHint = React.useCallback(async (key: keyof ResearchBlocks) => {
    if (!user || hintLoading || !blocks[key]) return;
    setHintLoading(key);
    const other = BLOCK_DEFS.filter((b) => b.key !== key).map((b) => blocks[b.key]).filter(Boolean).join(" ");
    const rawHint = await getBlockSuggestion(user.uid, BLOCK_DEFS.find((b) => b.key === key)!.label, blocks[key], other);
    const hint = rawHint ? stripMarkdown(rawHint) : rawHint;
    setBlockHints((prev) => ({ ...prev, [key]: hint ?? undefined }));
    setHintLoading(null);
  }, [user, blocks, hintLoading]);

  // ── Insight Engine ────────────────────────────────────────────────────────

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
    } catch { toast.error("Analysis failed"); }
    finally { setIsAnalyzing(false); }
  }, [user, blocks, isAnalyzing]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleTitleChange = (title: string) => {
    if (!currentDocId) return;
    setDocuments(documents.map((d) => (d.id === currentDocId ? { ...d, title } : d)));
  };

  const scrollToBlock = React.useCallback((key: keyof ResearchBlocks) => {
    const el = document.getElementById(`block-${key}`);
    const container = scrollContainerRef.current;
    if (!el || !container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    container.scrollTo({ top: container.scrollTop + (elRect.top - containerRect.top) - 16, behavior: "smooth" });
    setActiveNavBlock(key);
    // Expand if collapsed
    setCollapsedBlocks((prev) => { const n = new Set(prev); n.delete(key); return n; });
  }, []);

  const toggleCollapse = React.useCallback((key: keyof ResearchBlocks) => {
    setCollapsedBlocks((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);

  const applyTemplate = React.useCallback((tpl: typeof TEMPLATES[0]) => {
    if (!currentDocId) return;
    setBlocks(tpl.blocks);
    scheduleContentSave(currentDocId, tpl.blocks);
    setDismissedEmptyState(true);
    setCollapsedBlocks(new Set());
    toast.success(`${tpl.label} template loaded`);
  }, [currentDocId, scheduleContentSave]);

  const handleExport = React.useCallback(() => {
    const title = currentDoc?.title || "Research Document";
    const md = `# ${title}\n\n` +
      BLOCK_DEFS
        .filter((def) => blocks[def.key].trim())
        .map((def) => `## ${def.label}\n\n${blocks[def.key].trim()}`)
        .join("\n\n---\n\n");
    navigator.clipboard.writeText(md)
      .then(() => toast.success("Copied to clipboard", "Research exported as Markdown"))
      .catch(() => toast.error("Copy failed"));
  }, [blocks, currentDoc]);

  const health = computeHealth(blocks);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-background" onMouseUp={handleMouseUp}>

      {/* ── Top bar ── */}
      <div className="border-b border-border bg-card px-3 sm:px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Input
            value={currentDoc?.title ?? "Untitled Document"}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-9 flex-1 max-w-full sm:max-w-[400px] rounded-md border-border/70 bg-transparent px-2 text-sm font-medium focus-visible:bg-background"
            placeholder="Document title"
          />

          {/* Save status */}
          <span className={`hidden sm:inline font-mono text-[10px] transition-opacity duration-300 shrink-0 ${
            saveStatus === "saving" ? "text-muted-foreground opacity-70" :
            saveStatus === "saved"  ? "text-emerald-500 opacity-80" : "opacity-0"
          }`}>
            {saveStatus === "saving" ? "Saving…" : saveLabel}
          </span>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Export */}
            <button
              onClick={handleExport}
              disabled={blocksEmpty}
              title="Copy as Markdown"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Copy className="h-3 w-3" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Import URL */}
            <button
              onClick={() => setShowURLImport((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] font-mono text-[11px] font-medium border transition-all ${
                showURLImport
                  ? "border-primary/40 bg-primary/[0.07] text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Link2 className="h-3 w-3" />
              <span className="hidden sm:inline">Import URL</span>
            </button>
          </div>
        </div>
      </div>

      <URLImportBar
        visible={showURLImport}
        onImport={(text, title) => { setPendingImport({ text, title: title ?? null }); setShowURLImport(false); }}
        onDismiss={() => setShowURLImport(false)}
      />

      {/* ── Health Score bar ── */}
      <HealthScoreBar health={health} />

      {/* ── Main body ── */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* Left block-nav — lg+ only */}
        <BlockNav
          blocks={BLOCK_DEFS}
          blockValues={blocks}
          activeKey={activeNavBlock}
          onJump={scrollToBlock}
        />

        {/* Center: blocks — horizontal scroll row */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 px-3 sm:px-4 py-4"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full w-full gap-3 text-muted-foreground/50">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-mono text-[11px] uppercase tracking-widest">Loading…</span>
            </div>
          ) : showEmptyState ? (
            <EmptyStateTemplates
              templates={TEMPLATES}
              onApply={applyTemplate}
              onDismiss={() => setDismissedEmptyState(true)}
            />
          ) : (
            <div className="flex flex-row gap-3 h-full">
              {BLOCK_DEFS.map((def) => (
                <div
                  key={def.key}
                  id={`block-${def.key}`}
                  className="w-[300px] shrink-0 h-full"
                >
                  <ResearchBlock
                    def={def}
                    value={blocks[def.key]}
                    onChange={(v) => updateBlock(def.key, v)}
                    hint={blockHints[def.key] ?? null}
                    hintLoading={hintLoading === def.key}
                    onRequestHint={() => requestBlockHint(def.key)}
                    onApplyHint={() => {
                      const h = blockHints[def.key];
                      if (h) {
                        const clean = stripMarkdown(h);
                        updateBlock(def.key, blocks[def.key] ? `${blocks[def.key]}\n\n${clean}` : clean);
                        setBlockHints((prev) => ({ ...prev, [def.key]: undefined }));
                      }
                    }}
                    onIgnoreHint={() => setBlockHints((prev) => ({ ...prev, [def.key]: undefined }))}
                    collapsed={collapsedBlocks.has(def.key)}
                    onToggleCollapse={() => toggleCollapse(def.key)}
                    wordTarget={WORD_TARGETS[def.key]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Insight Engine — lg+ only */}
        <aside className="hidden lg:flex w-[288px] shrink-0 border-l border-border bg-card flex-col overflow-hidden">
          <InsightEngine
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
            blocksEmpty={blocksEmpty}
          />
        </aside>
      </div>

      {/* ── Mobile Insight FAB ── */}
      {!showMobileInsights && (
        <button
          onClick={() => setShowMobileInsights(true)}
          className="lg:hidden fixed bottom-5 right-4 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg font-mono text-[11px] font-semibold"
        >
          <Brain className="h-3.5 w-3.5" />
          Insights{analysis ? " ✓" : ""}
        </button>
      )}

      {/* ── Mobile Insight Sheet ── */}
      {showMobileInsights && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMobileInsights(false)}
          />
          <div className="bg-card border-t border-border rounded-t-2xl h-[72vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-foreground/70">
                  Insight Engine
                </span>
              </div>
              <button
                onClick={() => setShowMobileInsights(false)}
                className="text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <InsightEngine
                analysis={analysis}
                isAnalyzing={isAnalyzing}
                onAnalyze={handleAnalyze}
                blocksEmpty={blocksEmpty}
              />
            </div>
          </div>
        </div>
      )}

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

// ── BlockNav ──────────────────────────────────────────────────────────────────

function BlockNav({
  blocks: defs,
  blockValues,
  activeKey,
  onJump,
}: {
  blocks: typeof BLOCK_DEFS;
  blockValues: ResearchBlocks;
  activeKey: keyof ResearchBlocks | null;
  onJump: (key: keyof ResearchBlocks) => void;
}) {
  const completionColor: Record<BlockCompletion, string> = {
    empty:    "bg-muted-foreground/20",
    partial:  "bg-amber-400",
    complete: "bg-emerald-500",
  };

  return (
    <nav className="hidden lg:flex flex-col items-center py-5 gap-1 w-10 shrink-0 border-r border-border bg-card">
      {defs.map((def) => {
        const comp = getBlockCompletion(blockValues[def.key], WORD_TARGETS[def.key]);
        const isActive = activeKey === def.key;
        return (
          <div key={def.key} className="group relative flex items-center justify-center">
            <button
              onClick={() => onJump(def.key)}
              title={def.label}
              className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 ${
                isActive ? "bg-primary/10" : "hover:bg-muted/60"
              }`}
            >
              <div className={`rounded-full transition-all duration-200 ${completionColor[comp]} ${
                isActive ? "w-2.5 h-2.5" : "w-2 h-2"
              }`} />
            </button>
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-full ml-2.5 whitespace-nowrap rounded-md bg-foreground/90 px-2 py-1 font-mono text-[10px] text-background opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md">
              {def.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}

// ── EmptyStateTemplates ───────────────────────────────────────────────────────

function EmptyStateTemplates({
  templates,
  onApply,
  onDismiss,
}: {
  templates: typeof TEMPLATES;
  onApply: (t: typeof TEMPLATES[0]) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-8 text-center">
      <div className="h-12 w-12 rounded-2xl border border-border flex items-center justify-center mb-4 bg-card">
        <FileText className="h-6 w-6 text-muted-foreground/30" />
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1.5">Start your research</h3>
      <p className="text-[12px] text-muted-foreground/60 mb-6 max-w-xs leading-relaxed">
        Pick a template to pre-fill the blocks with a structured starting point, or start from scratch.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mb-5">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => onApply(tpl)}
            className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-3.5 text-left hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-sm transition-all duration-150 group"
          >
            <span className="text-xl">{tpl.emoji}</span>
            <span className="font-mono text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors">
              {tpl.label}
            </span>
            <span className="text-[10px] text-muted-foreground/55 leading-snug">{tpl.desc}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onDismiss}
        className="font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors underline underline-offset-2"
      >
        Start from scratch
      </button>
    </div>
  );
}

// ── HealthScoreBar ────────────────────────────────────────────────────────────

function scoreColor(v: number, invert = false): string {
  const n = invert ? 100 - v : v;
  return n >= 65 ? "bg-emerald-500" : n >= 35 ? "bg-amber-400" : "bg-rose-400";
}

function scoreRingColor(v: number): string {
  return v >= 65 ? "text-emerald-500" : v >= 35 ? "text-amber-400" : "text-rose-400";
}

function HealthScoreBar({ health }: { health: ReturnType<typeof computeHealth> }) {
  // SVG ring: r=15.9 → circumference ≈ 100, so strokeDasharray="${score} 100" fills correctly
  const ringColor = scoreRingColor(health.overall);
  return (
    <div className="px-3 sm:px-5 py-2.5 bg-card border-b border-border shrink-0">
      <div className="flex items-center gap-3 sm:gap-5">

        {/* Ring */}
        <div className="relative flex items-center justify-center w-11 h-11 shrink-0">
          <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.8"
              className="text-muted/30" stroke="currentColor" />
            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.8"
              strokeLinecap="round"
              stroke="currentColor"
              strokeDasharray={`${health.overall} 100`}
              className={`${ringColor} transition-all duration-700`} />
          </svg>
          <span className={`relative font-mono text-[13px] font-bold tabular-nums leading-none ${ringColor}`}>
            {health.overall}
          </span>
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        <div className="flex gap-2 sm:gap-4 flex-1 min-w-0">
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
  collapsed: boolean;
  onToggleCollapse: () => void;
  wordTarget: number;
}

function ResearchBlock({
  def, value, onChange, hint, hintLoading,
  onRequestHint, onApplyHint, onIgnoreHint,
  collapsed, onToggleCollapse, wordTarget,
}: ResearchBlockProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const wc = wordCount(value);
  const completion = getBlockCompletion(value, wordTarget);

  const borderAccent =
    completion === "complete" ? "border-l-[3px] border-l-emerald-500" :
    completion === "partial"  ? "border-l-[3px] border-l-amber-400"   : "";

  const dotColor =
    completion === "complete" ? "bg-emerald-500" :
    completion === "partial"  ? "bg-amber-400"   : "bg-muted-foreground/20";

  return (
    <div className={`h-full flex flex-col rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-border/80 transition-all duration-200 overflow-hidden group ${borderAccent}`}>

      {/* Block header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-border/50 bg-slate-50/60 dark:bg-muted/20 min-w-0 shrink-0">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {/* Completion dot */}
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} transition-colors duration-300`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground shrink-0">
            {def.label}
          </span>
          {/* Word count with target */}
          {wc > 0 && (
            <span className={`font-mono text-[9px] tabular-nums whitespace-nowrap shrink-0 transition-colors ${
              completion === "complete" ? "text-emerald-500/70" :
              completion === "partial"  ? "text-amber-500/70"   : "text-muted-foreground/40"
            }`}>
              {wc}/{wordTarget}w
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* AI suggest — shows on hover */}
          {!collapsed && (
            <button
              onClick={onRequestHint}
              disabled={hintLoading || completion === "empty"}
              title={`Get AI suggestion for ${def.label}`}
              className="flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] text-muted-foreground/50 hover:text-primary hover:bg-primary/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
            >
              {hintLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
              Suggest
            </button>
          )}
          {/* Collapse toggle */}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand" : "Collapse"}
            className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground/35 hover:text-foreground hover:bg-muted/40 transition-all opacity-0 group-hover:opacity-100"
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable textarea area */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={def.placeholder}
              className="w-full h-full min-h-[120px] resize-none bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
            />
          </div>

          {/* Bottom strip: hint card OR empty state label */}
          {hint ? (
            <div className="mx-3 mb-3 shrink-0 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2.5">
              <div className="flex items-start gap-2 mb-2">
                <Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-foreground/80 leading-relaxed">{hint}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onApplyHint}
                  className="flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-all">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Apply
                </button>
                <button onClick={onIgnoreHint}
                  className="flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-muted transition-all">
                  <X className="h-2.5 w-2.5" /> Ignore
                </button>
              </div>
            </div>
          ) : completion === "empty" ? (
            <div className="px-4 pb-3 shrink-0">
              <p className="text-[10px] text-muted-foreground/35 leading-relaxed">{def.hint}</p>
            </div>
          ) : null}
        </div>
      ) : (
        /* Collapsed: show a short preview */
        value.trim() ? (
          <div className="px-4 py-2.5">
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed line-clamp-3">{value.trim()}</p>
          </div>
        ) : null
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
  { key: "summary",       label: "Summary",             icon: Brain,         cls: "text-primary",     border: "border-primary/20",  bg: "bg-primary/[0.04]"                    },
  { key: "risks",         label: "Risks",               icon: AlertTriangle, cls: "text-amber-600",   border: "border-amber-200",   bg: "bg-amber-50 dark:bg-amber-950/20"     },
  { key: "opportunities", label: "Opportunities",       icon: TrendingUp,    cls: "text-emerald-600", border: "border-emerald-200", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
  { key: "missingInfo",   label: "Missing Information", icon: Lightbulb,     cls: "text-blue-500",    border: "border-blue-200",    bg: "bg-blue-50 dark:bg-blue-950/20"       },
];

function InsightEngine({ analysis, isAnalyzing, onAnalyze, blocksEmpty }: InsightEngineProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-foreground/70">
              Insight Engine
            </span>
          </div>
          {analysis && (
            <button onClick={() => setCollapsed(new Set())} title="Expand all"
              className="text-muted-foreground/40 hover:text-foreground transition-colors">
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

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
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
              <button onClick={() => toggle(sec.key)}
                className="w-full flex items-center justify-between px-3 py-2 text-left">
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
  selection, blocks, onBlockUpdate, onClose,
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
          <button key={action.id} onClick={() => apply(action.id)}
            className="w-full flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left">
            <span className="font-mono text-[11px] font-medium text-foreground">{action.label}</span>
            <span className="text-[10px] text-muted-foreground/55 leading-snug">{action.desc}</span>
          </button>
        ))}
      </div>
      <button onClick={onClose}
        className="absolute top-2 right-2 text-muted-foreground/35 hover:text-foreground transition-colors">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
