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
  Sparkles,
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
      { icon: FileText, label: "Research", view: "editor" },
      { icon: Lightbulb, label: "Signals", view: "insights" },
    ],
  },
  {
    label: "Argument",
    items: [{ icon: Compass, label: "Decisions", view: "decisions" }],
  },
  {
    label: "Verdict",
    items: [
      { icon: LayoutDashboard, label: "Spec", view: "prds" },
      { icon: CheckSquare, label: "Tasks", view: "tasks" },
    ],
  },
  {
    label: "Publish",
    items: [
      { icon: Share2, label: "Cases", view: "platform" },
      { icon: MessageSquare, label: "Slack", view: "slack" },
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

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${value}%`,
          background: "linear-gradient(to right, #8B5CF6, #22D3EE)",
        }}
      />
    </div>
  );
}

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
  const decisions = derivedDecisionCount(doc.id);
  const updatedAt = formatUpdatedAt(doc.updatedAt);

  return (
    <div
      className={`group relative rounded-xl p-3 cursor-pointer transition-all duration-200 ${
        isActive ? "animate-case-card-glow" : ""
      }`}
      style={{
        background: isActive
          ? "rgba(139, 92, 246, 0.10)"
          : "rgba(255, 255, 255, 0.03)",
        border: isActive
          ? "1px solid rgba(139, 92, 246, 0.35)"
          : "1px solid rgba(255, 255, 255, 0.06)",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(139, 92, 246, 0.20)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 16px rgba(139, 92, 246, 0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
        }
      }}
    >
      {/* Active glow dot */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="text-xs font-medium leading-snug flex-1 min-w-0 truncate"
          style={{ color: isActive ? "#E2D9FA" : "rgba(248, 250, 252, 0.75)" }}
        >
          {doc.title || "Untitled"}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive && (
            <span
              className="w-1.5 h-1.5 rounded-full animate-glow-pulse"
              style={{ background: "#8B5CF6" }}
            />
          )}
          <button
            type="button"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Delete"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="rgba(239,68,68,0.7)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Confidence bar */}
      <ConfidenceBar value={confidence} />

      {/* Meta row */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono font-semibold"
            style={{ color: "#8B5CF6" }}
          >
            {confidence}%
          </span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            ·
          </span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            {decisions} decisions
          </span>
        </div>
        {updatedAt && (
          <span
            className="text-[10px] font-mono"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
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
  const [isCreating, setIsCreating] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<"all" | "active" | "review" | "done">("all");
  const [docsError, setDocsError] = React.useState<string | null>(null);

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
    if (!user) {
      setDocuments([]);
      setDocsError(null);
      return;
    }
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
      const docs = await getUserDocuments(user.uid);
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

  const SIDEBAR_BG = "#0B1020";

  return (
    <div
      className="flex h-full flex-col text-white overflow-hidden"
      style={{ background: SIDEBAR_BG }}
    >
      {/* ── Logo + Workspace ── */}
      <div
        className="px-4 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg overflow-hidden"
              style={{ background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.3)" }}
            >
              <Image src="/logo.png" alt="Speckula" width={28} height={28} className="object-contain scale-150" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white/95">Speckula</p>
              <p className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>AI Workspace</p>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <span className="text-[10px] font-medium">Personal</span>
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* ── Navigation ── */}
        <nav className="px-3 pt-4 pb-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p
                className="px-2 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "rgba(255,255,255,0.22)" }}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeView === item.view;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveView(item.view)}
                      className="relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-all duration-150"
                      style={
                        isActive
                          ? {
                              background: "rgba(139, 92, 246, 0.15)",
                              color: "#C4A5FA",
                              boxShadow: "inset 2px 0 0 #8B5CF6",
                            }
                          : { color: "rgba(255,255,255,0.45)" }
                      }
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.80)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLButtonElement).style.background = "";
                          (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)";
                        }
                      }}
                    >
                      <item.icon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: isActive ? "#8B5CF6" : "inherit" }}
                      />
                      <span className={isActive ? "font-medium" : ""}>{item.label}</span>
                      {isActive && item.view === "decisions" && (
                        <span
                          className="ml-auto flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(139,92,246,0.2)", color: "#8B5CF6" }}
                        >
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
        <div className="mx-4 my-3" style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

        {/* ── Cases section ── */}
        <div className="px-3 pb-4">
          {/* Header */}
          <div className="flex items-center justify-between px-1 mb-3">
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "rgba(255,255,255,0.22)" }}
            >
              Cases
            </span>
            <button
              type="button"
              onClick={handleNewDoc}
              disabled={isCreating || !user}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all disabled:opacity-40"
              style={{
                background: "rgba(139,92,246,0.15)",
                color: "#A78BFA",
                border: "1px solid rgba(139,92,246,0.25)",
              }}
            >
              {isCreating
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <Plus className="w-2.5 h-2.5" />}
              New
            </button>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 h-8 mb-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <Search className="w-3 h-3 shrink-0" style={{ color: "rgba(255,255,255,0.30)" }} />
            <input
              type="text"
              placeholder="Search cases…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-white/25"
              style={{ color: "rgba(255,255,255,0.75)" }}
            />
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {(["all", "active", "review", "done"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize transition-all"
                style={
                  activeFilter === f
                    ? { background: "rgba(139,92,246,0.25)", color: "#C4A5FA", border: "1px solid rgba(139,92,246,0.40)" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)" }
                }
              >
                {f}
              </button>
            ))}
          </div>

          {/* Case cards */}
          <div className="space-y-2">
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
              <div
                className="rounded-xl p-4 text-center"
                style={{ border: "1px dashed rgba(139,92,246,0.2)" }}
              >
                <Sparkles className="w-4 h-4 mx-auto mb-1.5" style={{ color: "rgba(139,92,246,0.5)" }} />
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {searchQuery ? "No cases match your search" : "Create your first case"}
                </p>
              </div>
            )}

            {docsError && (
              <div
                className="rounded-lg p-3 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}
              >
                {docsError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── User section ── */}
      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {loading ? (
          <div className="h-10" />
        ) : user ? (
          <div className="space-y-2">
            {/* User row */}
            <div className="flex items-center gap-2.5 px-1">
              {user.photoURL ? (
                <div className="relative shrink-0">
                  <img
                    src={user.photoURL}
                    alt=""
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0B1020]"
                    style={{ background: "#22C55E" }}
                  />
                </div>
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)" }}
                >
                  <UserIcon className="w-3.5 h-3.5" style={{ color: "#8B5CF6" }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {user.displayName || "User"}
                </p>
                <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.30)" }}>
                  {user.email}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {isDarkMode
                  ? <Sun className="w-3 h-3" />
                  : <Moon className="w-3 h-3" />}
                {isDarkMode ? "Light" : "Dark"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.45)",
                }}
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
            className="w-full h-9 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #8B5CF6, #4F8CFF)",
              color: "#fff",
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
