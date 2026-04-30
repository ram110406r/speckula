"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  FileText,
  Lightbulb,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  Plus,
  File,
  Trash2,
  Loader2,
  Compass,
  Share2,
  MessageSquare,
  Bot,
  Moon,
  SunMedium,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore, type AppView } from "@/store/useAppStore";
import { NotificationBell } from "@/components/ui/notification-bell";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { activity } from "@/store/useActivityStore";
import {
  getUserDocuments,
  createDocument,
  deleteDocument,
  renameDocument,
} from "@/lib/firebase/db";

interface NavItem {
  icon: React.ElementType;
  label: string;
  view: AppView;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Bot,           label: "Autonomous Mode", view: "autonomous", group: "Agent"    },
  { icon: FileText,      label: "Research",         view: "editor",     group: "Evidence" },
  { icon: Lightbulb,     label: "Signals",          view: "insights",   group: "Evidence" },
  { icon: Compass,       label: "Decisions",        view: "decisions",  group: "Argument" },
  { icon: LayoutDashboard, label: "Spec",           view: "prds",       group: "Verdict"  },
  { icon: CheckSquare,   label: "Tasks",            view: "tasks",      group: "Verdict"  },
  { icon: Share2,        label: "Cases",            view: "platform",   group: "Publish"  },
  { icon: MessageSquare, label: "Slack",            view: "slack",      group: "Publish"  },
];

// Groups in order so we can render section labels
const GROUP_ORDER = ["Agent", "Evidence", "Argument", "Verdict", "Publish"];

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

  const [isCollapsed,  setIsCollapsed]  = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [isDarkMode,   setIsDarkMode]   = useState(false);
  const [isCreating,   setIsCreating]   = useState(false);
  const [docsError,    setDocsError]    = useState<string | null>(null);
  const [renamingId,   setRenamingId]   = useState<string | null>(null);
  const [renameValue,  setRenameValue]  = useState("");

  // ── theme init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (dark: boolean) => {
      setIsDarkMode(dark);
      document.documentElement.classList.toggle("dark", dark);
    };
    const stored = window.localStorage.getItem("Speckula-theme");
    apply(stored ? stored === "dark" : mql.matches);
    const onChange = (e: MediaQueryListEvent) => {
      if (!window.localStorage.getItem("Speckula-theme")) apply(e.matches);
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

  // ── collapse ────────────────────────────────────────────────────────────────
  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapsedChange?.(next);
  };

  // ── mobile auto-close on resize ─────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── documents ───────────────────────────────────────────────────────────────
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
    } catch {
      alert("Failed to create document.");
    } finally {
      setIsCreating(false);
    }
  }, [user, isCreating, resetForNewDocument, setDocuments, markDocumentAsNew, setCurrentDocId, setActiveView]);

  useKeyboardShortcuts(handleNewDocCb);

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
      activity.success("Document created");
    } catch {
      alert("Failed to create document.");
    } finally {
      setIsCreating(false);
    }
  };

  const startRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentTitle);
  };

  const commitRename = async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!user || !title) return;
    try {
      await renameDocument(user.uid, id, title);
      const docs = await getUserDocuments(user.uid);
      setDocuments(docs);
      activity.success("Document renamed", title);
    } catch { /* noop */ }
  };

  const handleDeleteDoc = async (e: React.MouseEvent, id: string) => {
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
  };

  const grouped = GROUP_ORDER.reduce<Record<string, NavItem[]>>((acc, g) => {
    const items = NAV_ITEMS.filter((i) => i.group === g);
    if (items.length) acc[g] = items;
    return acc;
  }, {});

  // ── shared sidebar content ──────────────────────────────────────────────────
  const SidebarContent = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-sidebar-border/80 bg-sidebar">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 shrink-0 flex items-center justify-center">
              <Image src="/logo.svg" alt="Speckula" width={22} height={22} className="object-contain" />
            </div>
            <span className="font-semibold text-sm tracking-tight truncate">Speckula</span>
          </div>
        )}
        {isCollapsed && (
          <div className="w-7 h-7 mx-auto flex items-center justify-center">
            <Image src="/logo.svg" alt="Speckula" width={22} height={22} className="object-contain" />
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="hidden md:flex p-1 rounded-md hover:bg-muted/60 transition-colors shrink-0"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed
            ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronLeft  className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-2 px-2">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="mb-3">
            {!isCollapsed && (
              <p className="px-2 mb-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                {group}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const isActive = activeView === item.view;
                return (
                  <li key={item.view} className="relative group/item">
                    <button
                      onClick={() => {
                        setActiveView(item.view);
                        setMobileOpen(false);
                      }}
                      className={`
                        relative flex h-8 w-full items-center rounded-md text-left text-xs transition-colors
                        ${isCollapsed ? "justify-center px-2" : "gap-2.5 px-2.5"}
                        ${isActive
                          ? "bg-accent text-primary font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }
                      `}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 z-50 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150">
                        <div className="px-2 py-1 bg-foreground text-background text-[11px] rounded-md whitespace-nowrap shadow-md">
                          {item.label}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* ── Documents ── */}
        {!isCollapsed && (
          <div className="mt-2 pt-2 border-t border-sidebar-border/40">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
                Documents
              </span>
              <button
                onClick={handleNewDoc}
                disabled={isCreating || !user}
                className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                title="New document"
              >
                {isCreating
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Plus className="h-3 w-3" />
                }
              </button>
            </div>

            <ul className="space-y-0.5">
              {documents.map((document) => {
                const isActive = currentDocId === document.id;
                const isRenaming = renamingId === document.id;
                return (
                  <li
                    key={document.id}
                    className={`group flex items-center gap-1.5 px-2 h-7 rounded-md transition-colors ${
                      isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    } ${isRenaming ? "cursor-default" : "cursor-pointer"}`}
                    onClick={() => { if (!isRenaming) { setCurrentDocId(document.id); setActiveView("editor"); } }}
                  >
                    <File className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(document.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(document.id);
                          if (e.key === "Escape") setRenamingId(null);
                          e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] flex-1 bg-transparent border-b border-primary/60 outline-none min-w-0"
                      />
                    ) : (
                      <span
                        className="text-[11px] truncate flex-1"
                        onDoubleClick={(e) => startRename(e, document.id, document.title)}
                        title="Double-click to rename"
                      >
                        {document.title}
                      </span>
                    )}
                    {!isRenaming && (
                      <button
                        onClick={(e) => handleDeleteDoc(e, document.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                        aria-label={`Delete ${document.title}`}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </li>
                );
              })}
              {user && documents.length === 0 && !isCreating && !docsError && (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground/50">No documents yet.</p>
              )}
              {docsError && (
                <p className="mx-1 my-1 rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
                  {docsError}
                </p>
              )}
            </ul>
          </div>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-sidebar-border/80 shrink-0">
        {loading ? (
          <div className="h-14" />
        ) : user ? (
          <div className={`p-2.5 ${isCollapsed ? "flex flex-col items-center gap-2" : ""}`}>
            {/* Profile row */}
            {!isCollapsed ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors">
                {user.photoURL ? (
                  <Image src={user.photoURL} alt="" width={26} height={26} className="rounded-full shrink-0" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserIcon className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] font-medium truncate">{user.displayName || "User"}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
              </div>
            ) : (
              <div className="relative group/profile flex justify-center">
                {user.photoURL ? (
                  <Image src={user.photoURL} alt="" width={28} height={28} className="rounded-full" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success border border-sidebar" />
                {/* Tooltip */}
                <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 z-50 opacity-0 group-hover/profile:opacity-100 transition-opacity">
                  <div className="px-2 py-1 bg-foreground text-background text-[11px] rounded-md whitespace-nowrap shadow-md">
                    {user.displayName || user.email}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {!isCollapsed ? (
              <div className="flex items-center gap-1 mt-1.5">
                <NotificationBell collapsed={isCollapsed} />
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 flex-1 justify-center h-7 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors px-2"
                >
                  {isDarkMode
                    ? <SunMedium className="h-3.5 w-3.5" />
                    : <Moon className="h-3.5 w-3.5" />
                  }
                  {isDarkMode ? "Light" : "Dark"}
                </button>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 flex-1 justify-center h-7 rounded-md text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors px-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <NotificationBell collapsed={isCollapsed} />
                <button onClick={toggleTheme} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={isDarkMode ? "Light mode" : "Dark mode"}>
                  {isDarkMode ? <SunMedium className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
                <button onClick={logout} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Sign out">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3">
            <button
              onClick={loginWithGoogle}
              className={`w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity ${isCollapsed ? "px-2" : ""}`}
            >
              {isCollapsed ? <UserIcon className="h-4 w-4 mx-auto" /> : "Sign in"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3.5 left-4 z-50 p-1.5 rounded-md bg-card border border-border shadow-sm md:hidden hover:bg-muted transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-64 z-50 shadow-xl transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 z-10 p-1 rounded-md hover:bg-muted transition-colors"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
        {SidebarContent}
      </div>

      {/* Desktop sidebar (renders inside Shell's grid cell) */}
      <div className="hidden md:block h-full overflow-visible">
        {SidebarContent}
      </div>
    </>
  );
}
