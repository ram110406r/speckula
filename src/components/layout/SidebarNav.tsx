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
    label: "Think",
    items: [
      { icon: FileText, label: "Notes", view: "editor" },
      { icon: Lightbulb, label: "Insights", view: "insights" },
    ],
  },
  {
    label: "Decide",
    items: [
      { icon: Compass, label: "Decisions", view: "decisions" },
    ],
  },
  {
    label: "Build",
    items: [
      { icon: LayoutDashboard, label: "PRDs", view: "prds" },
      { icon: CheckSquare, label: "Tasks", view: "tasks" },
    ],
  },
  {
    label: "Share",
    items: [
      { icon: Share2, label: "Public Cases", view: "platform" },
    ],
  },
];

export function SidebarNav() {
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const { activeView, setActiveView, documents, setDocuments, currentDocId, setCurrentDocId, resetForNewDocument, markDocumentAsNew } = useAppStore();
  const [isCreating, setIsCreating] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("buildcase-theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextIsDark = stored ? stored === "dark" : systemDark;
    setIsDarkMode(nextIsDark);
    document.documentElement.classList.toggle("dark", nextIsDark);
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDarkMode;
    setIsDarkMode(nextIsDark);
    document.documentElement.classList.toggle("dark", nextIsDark);
    window.localStorage.setItem("buildcase-theme", nextIsDark ? "dark" : "light");
  };

  // Sync Documents from Firestore
  useEffect(() => {
    if (!user) {
      setDocuments([]);
      return;
    }

    const fetchDocs = async () => {
      try {
        const docs = await getUserDocuments(user.uid);
        setDocuments(docs);
        
        // Auto-select first doc if none selected
        if (docs.length > 0 && !currentDocId) {
          setCurrentDocId(docs[0].id);
        }
      } catch (error) {
        console.error("[SidebarNav] Failed to fetch documents:", error);
        setDocuments([]);
      }
    };

    fetchDocs();
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
          <div className="w-8 h-8 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Buildcase Logo"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <span className="font-semibold text-lg tracking-tight">Buildcase</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="mt-3 space-y-4 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">{group.label}</p>
            {group.items.map((item) => {
              const isActive = activeView === item.view;
              return (
                <button
                  key={`${group.label}-${item.label}`}
                  className={`relative flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors ${isActive ? "bg-card text-primary" : "text-foreground/70 hover:bg-card/60 hover:text-foreground"}`}
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

      <div className="flex-1 flex flex-col min-h-0 mt-4">
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
        
        <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar px-3 pb-2">
          {documents.map((doc) => {
            const isActive = currentDocId === doc.id;
            return (
              <div
                key={doc.id}
                className={`group flex items-center gap-2 px-3 h-8 cursor-pointer rounded-md transition-colors ${
                  isActive ? "bg-card text-foreground" : "text-foreground/70 hover:bg-card/60 hover:text-foreground"
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

          {user && documents.length === 0 && !isCreating && (
            <p className="px-3 py-3 text-xs text-muted-foreground">No documents yet.</p>
          )}
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

