"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Home,
  BarChart3,
  TrendingUp,
  Target,
  Brain,
  Compass,
  FileText,
  GitBranch,
  FlaskConical,
  CheckSquare,
  Layers,
  Plug,
  Bot,
  Cpu,
  Activity,
  Puzzle,
  Bell,
  Settings,
  User as UserIcon,
  LogOut,
  Moon,
  SunMedium,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Plus,
  File,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";
import { ResearchBotIcon } from "@/components/ui/icons/ResearchBotIcon";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore, type AppView, type SpeckulaDocument } from "@/store/useAppStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { activity } from "@/store/useActivityStore";
import {
  getUserDocuments,
  createDocument,
  deleteDocument,
  renameDocument,
} from "@/lib/firebase/db";

// ── Navigation config ─────────────────────────────────────────────────────────

interface NavItemConfig {
  view: AppView;
  label: string;
  icon: React.ElementType;
  badge?: boolean;
  pulse?: boolean;
}

interface NavSectionConfig {
  id: string;
  label: string;
  collapsible: boolean;
  items: NavItemConfig[];
}

const NAV_SECTIONS: NavSectionConfig[] = [
  {
    id: "home",
    label: "Home",
    collapsible: false,
    items: [
      { view: "workspace",  label: "Workspace",  icon: Home      },
      { view: "dashboard",  label: "Dashboard",  icon: BarChart3 },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    collapsible: true,
    items: [
      { view: "editor",               label: "Research",            icon: ResearchBotIcon },
      { view: "market-intelligence",  label: "Market Intelligence", icon: TrendingUp      },
      { view: "competitors",          label: "Competitors",         icon: Target          },
      { view: "product-brain",        label: "Product Brain",       icon: Brain           },
    ],
  },
  {
    id: "decision-engine",
    label: "Decision Engine",
    collapsible: true,
    items: [
      { view: "decisions",      label: "Decisions",      icon: Compass    },
      { view: "specifications", label: "Specifications", icon: FileText   },
      { view: "roadmaps",       label: "Roadmaps",       icon: GitBranch  },
      { view: "experiments",    label: "Experiments",    icon: FlaskConical },
    ],
  },
  {
    id: "execution",
    label: "Execution",
    collapsible: true,
    items: [
      { view: "tasks",        label: "Tasks",        icon: CheckSquare },
      { view: "projects",     label: "Projects",     icon: Layers      },
      { view: "integrations", label: "Integrations", icon: Plug        },
    ],
  },
  {
    id: "ai-systems",
    label: "AI Systems",
    collapsible: true,
    items: [
      { view: "agents",    label: "Agents",          icon: Bot,      pulse: true },
      { view: "autonomous",label: "Autonomous Mode", icon: Cpu,      pulse: true },
      { view: "activity",  label: "Activity",        icon: Activity              },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    collapsible: true,
    items: [
      { view: "extension",     label: "Extension",     icon: Puzzle  },
      { view: "notifications", label: "Notifications", icon: Bell,   badge: true },
      { view: "settings",      label: "Settings",      icon: Settings },
      { view: "profile",       label: "Profile",       icon: UserIcon },
    ],
  },
];

// ── Primitives ────────────────────────────────────────────────────────────────

function Badge({ count }: { count: number }) {
  return (
    <span className="ml-auto flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function PulseDot() {
  return (
    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_5px_1px_rgba(52,211,153,0.5)] animate-pulse" />
  );
}

function Tooltip({ label, badge, badgeCount }: { label: string; badge?: boolean; badgeCount?: number }) {
  return (
    <div className="pointer-events-none absolute left-full top-1/2 z-[60] ml-2.5 -translate-y-1/2 opacity-0 group-hover/navitem:opacity-100 transition-opacity duration-150">
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border/70 bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-lg">
        {label}
        {badge && badgeCount && badgeCount > 0 ? (
          <span className="flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── NavItem ───────────────────────────────────────────────────────────────────

interface NavItemProps {
  item: NavItemConfig;
  isActive: boolean;
  isCollapsed: boolean;
  notifCount: number;
  onNavigate: (view: AppView) => void;
}

function NavItem({ item, isActive, isCollapsed, notifCount, onNavigate }: NavItemProps) {
  const Icon = item.icon;

  return (
    <li className="relative group/navitem">
      <button
        onClick={() => onNavigate(item.view)}
        className={[
          "relative flex w-full items-center rounded-[6px] text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
          "h-[30px]",
          isCollapsed ? "justify-center px-0" : "gap-2.5 px-2",
          isActive
            ? "bg-primary/[0.08] text-primary"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        ].join(" ")}
        aria-current={isActive ? "page" : undefined}
        title={isCollapsed ? item.label : undefined}
      >
        {/* Active left indicator */}
        {isActive && (
          <span className="absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-full bg-primary" />
        )}

        <Icon className={`h-[15px] w-[15px] shrink-0 ${isActive ? "text-primary" : ""}`} />

        {!isCollapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {item.badge && notifCount > 0 && <Badge count={notifCount} />}
            {item.pulse && <PulseDot />}
          </>
        )}
      </button>

      {/* Collapsed tooltip */}
      {isCollapsed && (
        <Tooltip
          label={item.label}
          badge={item.badge}
          badgeCount={notifCount}
        />
      )}
    </li>
  );
}

// ── NavSection ────────────────────────────────────────────────────────────────

interface NavSectionProps {
  section: NavSectionConfig;
  activeView: AppView;
  isCollapsed: boolean;
  isSectionCollapsed: boolean;
  onToggleSection: (id: string) => void;
  notifCount: number;
  onNavigate: (view: AppView) => void;
}

function NavSection({
  section,
  activeView,
  isCollapsed,
  isSectionCollapsed,
  onToggleSection,
  notifCount,
  onNavigate,
}: NavSectionProps) {
  const expanded = !isSectionCollapsed;

  return (
    <div className="mb-1">
      {/* Section header */}
      {!isCollapsed && (
        <div className="flex items-center justify-between px-2 mb-0.5 h-[22px]">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/40 select-none">
            {section.label}
          </span>
          {section.collapsible && (
            <button
              onClick={() => onToggleSection(section.id)}
              className="p-0.5 rounded hover:bg-muted/50 transition-colors"
              aria-label={expanded ? `Collapse ${section.label}` : `Expand ${section.label}`}
            >
              <ChevronDown
                className={`h-3 w-3 text-muted-foreground/40 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
              />
            </button>
          )}
        </div>
      )}

      {/* Items with collapse animation */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden min-h-0">
          <ul className="space-y-[1px] pb-1">
            {section.items.map((item) => (
              <NavItem
                key={item.view}
                item={item}
                isActive={activeView === item.view}
                isCollapsed={isCollapsed}
                notifCount={notifCount}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* Separator between sections when collapsed */}
      {isCollapsed && (
        <div className="mx-3 my-1.5 border-t border-border/30" />
      )}
    </div>
  );
}

// ── DocumentsSection ──────────────────────────────────────────────────────────

interface DocumentsSectionProps {
  user: ReturnType<typeof useAuth>["user"];
  documents: SpeckulaDocument[];
  currentDocId: string | null;
  isCreating: boolean;
  docsError: string | null;
  renamingId: string | null;
  renameValue: string;
  docSearch: string;
  onDocSearch: (v: string) => void;
  onNewDoc: () => void;
  onSelectDoc: (id: string) => void;
  onDeleteDoc: (e: React.MouseEvent, id: string) => void;
  onStartRename: (e: React.MouseEvent, id: string, title: string) => void;
  onCommitRename: (id: string) => void;
  onRenameKeyDown: (e: React.KeyboardEvent, id: string) => void;
  onRenameChange: (v: string) => void;
  onCancelRename: () => void;
}

function DocumentsSection({
  user, documents, currentDocId, isCreating, docsError,
  renamingId, renameValue, docSearch, onDocSearch,
  onNewDoc, onSelectDoc, onDeleteDoc, onStartRename,
  onCommitRename, onRenameKeyDown, onRenameChange, onCancelRename,
}: DocumentsSectionProps) {
  const filtered = docSearch.trim()
    ? documents.filter((d) => d.title.toLowerCase().includes(docSearch.toLowerCase()))
    : documents;

  return (
    <div className="mt-1 pt-2 border-t border-border/30">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-1.5 h-[22px]">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/40 select-none">
          Documents
        </span>
        <button
          onClick={onNewDoc}
          disabled={isCreating || !user}
          className="p-0.5 rounded hover:bg-muted/50 transition-colors disabled:opacity-40 text-muted-foreground hover:text-primary"
          title="New document (⌘N)"
        >
          {isCreating
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Plus className="h-3 w-3" />
          }
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-1.5 mx-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground/40 pointer-events-none" />
        <input
          value={docSearch}
          onChange={(e) => onDocSearch(e.target.value)}
          placeholder="Search documents…"
          className="w-full h-6 rounded-md bg-muted/40 border border-border/40 pl-6 pr-2 text-[10.5px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
        />
      </div>

      {/* Document list */}
      <ul className="space-y-[1px]">
        {filtered.map((doc) => {
          const isActive = currentDocId === doc.id;
          const isRenaming = renamingId === doc.id;
          return (
            <li
              key={doc.id}
              className={`group flex items-center gap-1.5 px-2 h-[28px] rounded-[6px] transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary/[0.08] text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              } ${isRenaming ? "cursor-default" : ""}`}
              onClick={() => { if (!isRenaming) onSelectDoc(doc.id); }}
            >
              <File className="h-[12px] w-[12px] shrink-0 text-muted-foreground/40" />
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => onRenameChange(e.target.value)}
                  onBlur={() => onCommitRename(doc.id)}
                  onKeyDown={(e) => onRenameKeyDown(e, doc.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] flex-1 bg-transparent border-b border-primary/60 outline-none min-w-0"
                />
              ) : (
                <span
                  className="text-[11px] truncate flex-1"
                  onDoubleClick={(e) => onStartRename(e, doc.id, doc.title)}
                  title="Double-click to rename"
                >
                  {doc.title}
                </span>
              )}
              {!isRenaming && (
                <button
                  onClick={(e) => onDeleteDoc(e, doc.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-opacity"
                  aria-label={`Delete ${doc.title}`}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </li>
          );
        })}
        {user && filtered.length === 0 && !isCreating && !docsError && (
          <p className="px-2 py-2 text-[11px] text-muted-foreground/40 text-center">
            {docSearch ? "No matches" : "No documents yet"}
          </p>
        )}
        {docsError && (
          <p className="mx-1 my-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
            {docsError}
          </p>
        )}
      </ul>
    </div>
  );
}

// ── SidebarFooter ─────────────────────────────────────────────────────────────

interface SidebarFooterProps {
  user: ReturnType<typeof useAuth>["user"];
  isDarkMode: boolean;
  isCollapsed: boolean;
  onToggleTheme: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

function SidebarFooter({ user, isDarkMode, isCollapsed, onToggleTheme, onLogin, onLogout }: SidebarFooterProps) {
  if (!user) {
    return (
      <div className="border-t border-border/50 p-2.5">
        <button
          onClick={onLogin}
          className="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
        >
          {isCollapsed ? <UserIcon className="h-4 w-4 mx-auto" /> : "Sign in with Google"}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 shrink-0">
      <div className={`p-2.5 ${isCollapsed ? "flex flex-col items-center gap-1.5" : ""}`}>
        {/* Avatar row */}
        {!isCollapsed ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
            {user.photoURL ? (
              <Image src={user.photoURL} alt="" width={24} height={24} className="rounded-full shrink-0" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UserIcon className="h-3 w-3 text-primary" />
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-medium truncate">{user.displayName || "User"}</span>
              <span className="text-[10px] text-muted-foreground/60 truncate">{user.email}</span>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
          </div>
        ) : (
          <div className="relative group/avatar flex justify-center">
            {user.photoURL ? (
              <Image src={user.photoURL} alt="" width={28} height={28} className="rounded-full" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <UserIcon className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-sidebar ring-0" />
            <Tooltip label={user.displayName || user.email || "Profile"} />
          </div>
        )}

        {/* Actions */}
        <div className={`${isCollapsed ? "flex flex-col items-center gap-1 mt-1" : "flex items-center gap-1 mt-1.5"}`}>
          <button
            onClick={onToggleTheme}
            className={`flex items-center gap-1.5 h-[28px] rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${
              isCollapsed ? "w-8 justify-center" : "flex-1 justify-center px-2"
            }`}
            title={isDarkMode ? "Switch to light" : "Switch to dark"}
          >
            {isDarkMode
              ? <SunMedium className="h-3.5 w-3.5 shrink-0" />
              : <Moon className="h-3.5 w-3.5 shrink-0" />
            }
            {!isCollapsed && (isDarkMode ? "Light" : "Dark")}
          </button>
          <button
            onClick={onLogout}
            className={`flex items-center gap-1.5 h-[28px] rounded-md text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ${
              isCollapsed ? "w-8 justify-center" : "flex-1 justify-center px-2"
            }`}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!isCollapsed && "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ModernSidebar (main) ──────────────────────────────────────────────────────

interface ModernSidebarProps {
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function ModernSidebar({ onCollapsedChange }: ModernSidebarProps) {
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const {
    activeView, setActiveView,
    documents, setDocuments,
    currentDocId, setCurrentDocId,
    resetForNewDocument, markDocumentAsNew,
  } = useAppStore();

  // ── sidebar state ────────────────────────────────────────────────────────────
  const [isCollapsed,    setIsCollapsed]    = useState(false);
  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [isDarkMode,     setIsDarkMode]     = useState(false);
  const [isCreating,     setIsCreating]     = useState(false);
  const [docsError,      setDocsError]      = useState<string | null>(null);
  const [renamingId,     setRenamingId]     = useState<string | null>(null);
  const [renameValue,    setRenameValue]    = useState("");
  const [docSearch,      setDocSearch]      = useState("");
  const [notifCount,     setNotifCount]     = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem("speckula-nav-collapsed");
      return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  // ── theme ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (dark: boolean) => {
      setIsDarkMode(dark);
      document.documentElement.classList.toggle("dark", dark);
    };
    const stored = localStorage.getItem("Speckula-theme");
    apply(stored ? stored === "dark" : mql.matches);
    const onChange = (e: MediaQueryListEvent) => { if (!localStorage.getItem("Speckula-theme")) apply(e.matches); };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("Speckula-theme", next ? "dark" : "light");
  };

  // ── collapse ─────────────────────────────────────────────────────────────────
  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapsedChange?.(next);
  };

  // ── mobile close on resize ───────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── section collapse toggle ──────────────────────────────────────────────────
  const toggleSection = useCallback((id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("speckula-nav-collapsed", JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, []);

  // ── notification badge ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setNotifCount(0); return; }
    let cancelled = false;
    user.getIdToken().then((token) =>
      fetch("/api/notifications?unreadOnly=true", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled && d?.ok) setNotifCount(d.data.unreadCount ?? 0); })
        .catch(() => {})
    ).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // ── documents ────────────────────────────────────────────────────────────────
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
            ? "Couldn't load documents — permission denied."
            : "Couldn't load documents — try reloading."
        );
        setDocuments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [user, setDocuments, currentDocId, setCurrentDocId]);

  const handleNewDocCb = useCallback(async () => {
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
      activity.success("Document created");
    } catch { alert("Failed to create document."); }
    finally { setIsCreating(false); }
  }, [user, isCreating, resetForNewDocument, setDocuments, markDocumentAsNew, setCurrentDocId, setActiveView]);

  useKeyboardShortcuts(handleNewDocCb);

  const handleSelectDoc = useCallback((id: string) => {
    setCurrentDocId(id);
    setActiveView("editor");
    setMobileOpen(false);
  }, [setCurrentDocId, setActiveView]);

  const handleDeleteDoc = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user || !window.confirm("Delete this document?")) return;
    try {
      await deleteDocument(user.uid, id);
      const docs = await getUserDocuments(user.uid);
      setDocuments(docs);
      if (currentDocId === id) {
        resetForNewDocument();
        setCurrentDocId(docs.length > 0 ? docs[0].id : null);
      }
    } catch { /* noop */ }
  }, [user, currentDocId, setDocuments, resetForNewDocument, setCurrentDocId]);

  const handleStartRename = useCallback((e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(title);
  }, []);

  const handleCommitRename = useCallback(async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!user || !title) return;
    try {
      await renameDocument(user.uid, id, title);
      const docs = await getUserDocuments(user.uid);
      setDocuments(docs);
      activity.success("Document renamed", title);
    } catch { /* noop */ }
  }, [user, renameValue, setDocuments]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") handleCommitRename(id);
    if (e.key === "Escape") setRenamingId(null);
    e.stopPropagation();
  }, [handleCommitRename]);

  const handleNavigate = useCallback((view: AppView) => {
    setActiveView(view);
    setMobileOpen(false);
  }, [setActiveView]);

  // ── shared content ───────────────────────────────────────────────────────────
  const SidebarContent = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-sidebar-border/60 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center">
              <Image src="/logo.png" alt="Speckula" width={48} height={48} className="object-contain scale-[1.6]" />
            </div>
            <span className="font-semibold text-[13px] tracking-tight truncate text-foreground">Speckula</span>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto flex items-center justify-center">
            <Image src="/logo.png" alt="Speckula" width={48} height={48} className="object-contain scale-[1.6]" />
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="hidden md:flex p-1 rounded-md hover:bg-muted/50 transition-colors shrink-0 text-muted-foreground"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <ChevronLeft  className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2.5 px-2 custom-scrollbar"
        aria-label="Main navigation"
      >
        {NAV_SECTIONS.map((section) => (
          <NavSection
            key={section.id}
            section={section}
            activeView={activeView}
            isCollapsed={isCollapsed}
            isSectionCollapsed={collapsedSections.has(section.id)}
            onToggleSection={toggleSection}
            notifCount={notifCount}
            onNavigate={handleNavigate}
          />
        ))}

        {/* Documents */}
        {!isCollapsed && (
          <DocumentsSection
            user={user}
            documents={documents}
            currentDocId={currentDocId}
            isCreating={isCreating}
            docsError={docsError}
            renamingId={renamingId}
            renameValue={renameValue}
            docSearch={docSearch}
            onDocSearch={setDocSearch}
            onNewDoc={handleNewDocCb}
            onSelectDoc={handleSelectDoc}
            onDeleteDoc={handleDeleteDoc}
            onStartRename={handleStartRename}
            onCommitRename={handleCommitRename}
            onRenameKeyDown={handleRenameKeyDown}
            onRenameChange={setRenameValue}
            onCancelRename={() => setRenamingId(null)}
          />
        )}
      </nav>

      {/* Footer */}
      {loading ? (
        <div className="h-14 shrink-0" />
      ) : (
        <SidebarFooter
          user={user}
          isDarkMode={isDarkMode}
          isCollapsed={isCollapsed}
          onToggleTheme={toggleTheme}
          onLogin={loginWithGoogle}
          onLogout={logout}
        />
      )}
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-md bg-card border border-border shadow-sm md:hidden hover:bg-muted transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-[80vw] max-w-[280px] z-50 shadow-xl transition-transform duration-300 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 z-10 p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
        {SidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block h-full overflow-visible">
        {SidebarContent}
      </div>
    </>
  );
}
