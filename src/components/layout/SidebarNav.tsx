"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import {
  FileText,
  Lightbulb,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  Plus,
  Loader2,
  Compass,
  Share2,
  MessageSquare,
  Bot,
  Search,
  Sun,
  Moon,
  ChevronDown,
  Activity,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore, type AppView } from "@/store/useAppStore";
import { getUserDocuments, createDocument, deleteDocument } from "@/lib/firebase/db";

// ── Nav groups ────────────────────────────────────────────────────────────────

interface NavItem {
  icon: React.ElementType;
  label: string;
  view: AppView;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Agent",
    items: [{ icon: Bot, label: "Autonomous Mode", view: "autonomous" }],
  },
  {
    label: "Evidence",
    items: [
      { icon: FileText,  label: "Research",  view: "editor"   },
      { icon: Lightbulb, label: "Signals",   view: "insights" },
    ],
  },
  {
    label: "Argument",
    items: [{ icon: Compass, label: "Decisions", view: "decisions" }],
  },
  {
    label: "Verdict",
    items: [
      { icon: LayoutDashboard, label: "Spec",  view: "prds"  },
      { icon: CheckSquare,     label: "Tasks", view: "tasks" },
    ],
  },
  {
    label: "Publish",
    items: [
      { icon: Share2,       label: "Cases", view: "platform" },
      { icon: MessageSquare, label: "Slack", view: "slack"   },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function derivedConfidence(id: string): number {
  return 62 + (hashInt(id) % 36);
}

function derivedDecisionCount(id: string): number {
  return 1 + (hashInt(id + "dc") % 7);
}

function formatUpdatedAt(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const ts = value as { toDate?: () => Date };
  const date = typeof ts.toDate === "function" ? ts.toDate() : null;
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(1, min)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Case card ─────────────────────────────────────────────────────────────────

function CaseCard({
  doc,
  isActive,
  onClick,
  onDelete,
}: {
  doc: { id: string; title: string; updatedAt: unknown };
  isActive: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const confidence = derivedConfidence(doc.id);
  const decisions  = derivedDecisionCount(doc.id);
  const updatedAt  = formatUpdatedAt(doc.updatedAt);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`group relative rounded cursor-pointer transition-all duration-100 px-3 py-2.5 ${
        isActive
          ? "bg-amber-600 text-white"
          : "hover:bg-slate-800 text-slate-300"
      }`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <span className={`text-[13px] font-medium leading-snug flex-1 min-w-0 truncate ${
          isActive ? "text-white" : "text-slate-200"
        }`}>
          {doc.title || "Untitled"}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-glow-pulse" />
          )}
          <button
            type="button"
            onClick={onDelete}
            className={`opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 ${
              isActive
                ? "hover:bg-amber-700 text-amber-200"
                : "hover:bg-slate-700 text-slate-500 hover:text-red-400"
            }`}
            aria-label="Delete case"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-2 h-0.5 rounded-full overflow-hidden bg-slate-700">
        <div
          className={`h-full rounded-full transition-all ${isActive ? "bg-amber-300" : "bg-slate-500"}`}
          style={{ width: `${confidence}%` }}
        />
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-mono font-bold ${isActive ? "text-amber-200" : "text-amber-500"}`}>
            {confidence}%
          </span>
          <span className={`text-[10px] ${isActive ? "text-amber-300/60" : "text-slate-600"}`}>·</span>
          <span className={`text-[10px] ${isActive ? "text-amber-200/70" : "text-slate-500"}`}>
            {decisions} decisions
          </span>
        </div>
        {updatedAt && (
          <span className={`text-[10px] font-mono ${isActive ? "text-amber-200/60" : "text-slate-600"}`}>
            {updatedAt}
          </span>
        )}
      </div>
    </div>
  );
}

// ── SidebarNav ────────────────────────────────────────────────────────────────

export function SidebarNav() {
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const {
    activeView, setActiveView,
    documents, setDocuments,
    currentDocId, setCurrentDocId,
    resetForNewDocument, markDocumentAsNew,
  } = useAppStore();

  const [isCreating,   setIsCreating]   = React.useState(false);
  const [isDarkMode,   setIsDarkMode]   = React.useState(false);
  const [searchQuery,  setSearchQuery]  = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<"all" | "active" | "review" | "done">("all");
  const [docsError,    setDocsError]    = React.useState<string | null>(null);

  // ── Theme ──────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark: boolean) => {
      setIsDarkMode(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    };
    const stored = window.localStorage.getItem("Speckula-theme");
    apply(stored ? stored === "dark" : mql.matches);
    const onChange = (e: MediaQueryListEvent) => {
      if (window.localStorage.getItem("Speckula-theme")) return;
      apply(e.matches);
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("Speckula-theme", next ? "dark" : "light");
  };

  // ── Documents ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setDocuments([]); setDocsError(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const docs = await getUserDocuments(user.uid);
        if (cancelled) return;
        setDocuments(docs);
        setDocsError(null);
        if (docs.length > 0 && !currentDocId) setCurrentDocId(docs[0].id);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "";
        setDocsError(
          /permission-denied|insufficient permission/i.test(msg)
            ? "Firestore access denied — check your account."
            : "Couldn't load documents — try reloading."
        );
      }
    })();
    return () => { cancelled = true; };
  }, [user, setDocuments, currentDocId, setCurrentDocId]);

  const handleNewDoc = async () => {
    if (!user || isCreating) return;
    setIsCreating(true);
    try {
      resetForNewDocument();
      const newId = await createDocument(user.uid);
      const docs  = await getUserDocuments(user.uid);
      setDocuments(docs);
      markDocumentAsNew(newId);
      setCurrentDocId(newId);
      setActiveView("editor");
    } catch (err) {
      console.error("[SidebarNav] Failed to create document:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDoc = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user || !window.confirm("Delete this case?")) return;
    try {
      await deleteDocument(user.uid, id);
      const docs = await getUserDocuments(user.uid);
      setDocuments(docs);
      if (currentDocId === id) {
        resetForNewDocument();
        setCurrentDocId(docs.length > 0 ? docs[0].id : null);
      }
    } catch (err) {
      console.error("[SidebarNav] Failed to delete:", err);
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground overflow-hidden">

      {/* ── Logo + workspace ── */}
      <div className="px-4 py-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 overflow-hidden bg-slate-800">
              <Image src="/logo.png" alt="Speckula" width={28} height={28} className="object-contain scale-150" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-50 leading-tight">Speckula</p>
              <p className="text-[10px] font-mono text-slate-500 leading-tight">Product Intelligence</p>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Personal
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">

        {/* ── Navigation ── */}
        <nav className="px-2 pt-4 pb-2">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                {group.label}
              </p>
              <div className="space-y-px">
                {group.items.map((item) => {
                  const isActive = activeView === item.view;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveView(item.view)}
                      className={`flex h-8 w-full items-center gap-2.5 rounded px-2.5 text-left text-[13px] font-medium transition-all duration-100 ${
                        isActive
                          ? "bg-amber-600 text-white"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.label}</span>
                      {isActive && item.view === "decisions" && (
                        <span className="ml-auto flex items-center gap-1 text-[9px] font-mono bg-amber-700 px-1.5 py-0.5 rounded text-amber-200">
                          <Activity className="w-2.5 h-2.5" />
                          Live
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Divider ── */}
        <div className="mx-3 border-t border-slate-800 mb-4" />

        {/* ── Cases ── */}
        <div className="px-2 pb-4">
          {/* Header */}
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Cases
            </span>
            <button
              type="button"
              onClick={handleNewDoc}
              disabled={isCreating || !user}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-40"
            >
              {isCreating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
              New
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded bg-slate-800 px-2.5 h-8 mb-3 border border-slate-700 focus-within:border-amber-600 transition-colors">
            <Search className="w-3 h-3 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search cases…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[12px] text-slate-200 placeholder:text-slate-600 outline-none"
            />
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            {(["all", "active", "review", "done"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  activeFilter === f
                    ? "bg-amber-600 text-white"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Case cards */}
          <div className="space-y-0.5">
            {filteredDocs.map((doc) => (
              <CaseCard
                key={doc.id}
                doc={doc}
                isActive={currentDocId === doc.id}
                onClick={() => {
                  setCurrentDocId(doc.id);
                  setActiveView("decisions");
                }}
                onDelete={(e) => handleDeleteDoc(e, doc.id)}
              />
            ))}

            {user && filteredDocs.length === 0 && !isCreating && !docsError && (
              <div className="px-3 py-4 text-center">
                <p className="text-[11px] text-slate-600">
                  {searchQuery ? "No cases match your search" : "No cases yet. Create one to start."}
                </p>
              </div>
            )}

            {docsError && (
              <div className="mx-2 rounded border border-red-900/50 bg-red-900/20 px-3 py-2 text-xs text-red-400">
                {docsError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── User section ── */}
      <div className="shrink-0 border-t border-slate-800 px-3 py-3">
        {loading ? (
          <div className="h-10" />
        ) : user ? (
          <div className="space-y-2">
            {/* User row */}
            <div className="flex items-center gap-2.5 px-1">
              {user.photoURL ? (
                <div className="relative shrink-0">
                  <img src={user.photoURL} alt="" width={28} height={28} className="rounded-full" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-slate-900" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-200 truncate leading-tight">
                  {user.displayName || "User"}
                </p>
                <p className="text-[10px] text-slate-500 truncate leading-tight">{user.email}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[11px] font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                {isDarkMode ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                {isDarkMode ? "Light" : "Dark"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[11px] font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full h-9 rounded text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
