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
  File,
  Trash2,
  Loader2,
  Compass,
  Share2,
  MessageSquare,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore, type AppView } from "@/store/useAppStore";
import { getUserDocuments, createDocument, deleteDocument } from "@/lib/firebase/db";
import { Moon, SunMedium } from "lucide-react";

interface GroupedNavItem {
  icon: React.ElementType;
  label: string;
  view: AppView;
}

const navGroups: { label: string; items: GroupedNavItem[] }[] = [
  {
    label: "Agent",
    items: [
      { icon: Bot, label: "Autonomous Mode", view: "autonomous" },
    ],
  },
  {
    label: "Evidence",
    items: [
      { icon: FileText, label: "Research", view: "editor" },
      { icon: Lightbulb, label: "Signals", view: "market-intelligence" },
    ],
  },
  {
    label: "Argument",
    items: [
      { icon: Compass, label: "Decisions", view: "decisions" },
    ],
  },
  {
    label: "Verdict",
    items: [
      { icon: LayoutDashboard, label: "Spec", view: "specifications" },
      { icon: CheckSquare, label: "Tasks", view: "tasks" },
    ],
  },
  {
    label: "Publish",
    items: [
      { icon: Share2, label: "Cases", view: "projects" },
      { icon: MessageSquare, label: "Slack", view: "integrations" },
    ],
  },
];


const nextStepHints: Partial<Record<AppView, string>> = {
  editor: "Add your research, then generate signals →",
  "market-intelligence": "Review signals, then score decisions →",
  decisions: "Score a decision, then write the spec →",
  specifications: "Spec approved? Break it into tasks →",
  tasks: "Ship it. Then close the loop.",
};

export function SidebarNav() {
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const { activeView, setActiveView, documents, setDocuments, currentDocId, setCurrentDocId, resetForNewDocument, markDocumentAsNew } = useAppStore();
  const [isCreating, setIsCreating] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark: boolean) => {
      setIsDarkMode(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    };
    const stored = window.localStorage.getItem("Speckula-theme");
    apply(stored ? stored === "dark" : mql.matches);

    // Respond to OS theme changes when the user has no explicit override —
    // otherwise the app drifts out of sync with the system after a session
    // because the initial computation is one-shot.
    const onChange = (event: MediaQueryListEvent) => {
      const latestStored = window.localStorage.getItem("Speckula-theme");
      if (latestStored) return;
      apply(event.matches);
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDarkMode;
    setIsDarkMode(nextIsDark);
    document.documentElement.classList.toggle("dark", nextIsDark);
    window.localStorage.setItem("Speckula-theme", nextIsDark ? "dark" : "light");
  };

  const [docsError, setDocsError] = React.useState<string | null>(null);

  // Sync Documents from Firestore. We use a `cancelled` flag rather than
  // an AbortController because the firebase-js SDK's getDocs doesn't
  // accept a signal — but we still need to drop a stale response that
  // arrives after the user signs out and back in as a different account.
  useEffect(() => {
    if (!user) {
      setDocuments([]);
      setDocsError(null);
      return;
    }

    let cancelled = false;
    const fetchDocs = async () => {
      try {
        const docs = await getUserDocuments(user.uid);
        if (cancelled) return;
        setDocuments(docs);
        setDocsError(null);

        if (docs.length > 0 && !currentDocId) {
          setCurrentDocId(docs[0].id);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[SidebarNav] Failed to fetch documents:", error);
        setDocuments([]);
        const message = error instanceof Error ? error.message : "";
        setDocsError(
          /permission-denied|insufficient permission/i.test(message)
            ? "Couldn't load your documents — Firestore rules denied the read. Check that you're signed in to the right account."
            : "Couldn't load your documents — try reloading."
        );
      }
    };

    fetchDocs();
    return () => {
      cancelled = true;
    };
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
    } catch (error) {
      console.error("[SidebarNav] Failed to create document:", error);
      alert("Failed to create document. Please check console for details.");
    } finally {
      setIsCreating(false);
    }
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
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground transition-colors duration-300">
      {/* Logo */}
      <div className="px-6 py-4 border-b border-sidebar-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <Image
              src="/logo.png"
              alt="Speckula Logo"
              width={64}
              height={64}
              className="object-contain scale-[1.7]"
            />
          </div>
          <span className="font-semibold text-lg tracking-tight">Speckula</span>
        </div>
      </div>

      {/* Scrollable middle: nav + documents */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* Main Navigation */}
        <nav className="mt-3 space-y-4 px-3">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              <p className="px-3 mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/60">{group.label}</p>
              {group.items.map((item) => {
                const isActive = activeView === item.view;
                return (
                  <button
                    key={`${group.label}-${item.label}`}
                    className={`relative flex h-9 w-full items-center gap-2.5 rounded-lg pl-3 pr-3 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-accent text-primary font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    onClick={() => setActiveView(item.view)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {nextStepHints[activeView] && (
          <p className="px-4 py-2 text-[11px] italic text-muted-foreground/50">
            {nextStepHints[activeView]}
          </p>
        )}

        <div className="mt-4">
          <div className="px-6 py-2 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">Documents</span>
            <button
              onClick={handleNewDoc}
              disabled={isCreating || !user}
              className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 p-1"
            >
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="space-y-0.5 px-3 pb-2">
            {documents.map((doc) => {
            const isActive = currentDocId === doc.id;
            return (
              <div
                key={doc.id}
                className={`group flex items-center gap-2 px-3 h-8 cursor-pointer rounded-md transition-colors ${
                  isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => {
                  setCurrentDocId(doc.id);
                  setActiveView("editor");
                }}
              >
                <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                <span className="text-xs truncate flex-1">{doc.title}</span>
                <button
                  onClick={(e) => handleDeleteDoc(e, doc.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                  aria-label={`Delete ${doc.title}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}

            {user && documents.length === 0 && !isCreating && !docsError && (
              <p className="px-3 py-3 text-xs text-muted-foreground">No documents yet.</p>
            )}
            {user && docsError && (
              <p className="mx-2 my-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {docsError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* User Section */}
      <div className="mt-auto border-t border-sidebar-border/80">
        {loading ? (
          <div className="px-4 py-4 h-16" />
        ) : user ? (
          <div className="px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full shrink-0"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserIcon className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-foreground truncate">
                  {user.displayName || "User"}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">
                  {user.email}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 justify-start text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={toggleTheme}
                type="button"
              >
                {isDarkMode ? <SunMedium className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />}
                {isDarkMode ? "Light" : "Dark"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 justify-start text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={logout}
                type="button"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4">
            <Button
              className="w-full h-9"
              onClick={loginWithGoogle}
            >
              Sign in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

