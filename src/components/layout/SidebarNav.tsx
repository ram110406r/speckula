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
  Users
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
  secondary?: boolean;
}

const navGroups: { label: string; items: GroupedNavItem[] }[] = [
  {
    label: "THINK",
    items: [
      { icon: FileText, label: "Notes", view: "editor" },
      { icon: Lightbulb, label: "Insights", view: "insights" },
    ],
  },
  {
    label: "DECIDE",
    items: [
      { icon: Compass, label: "Decision Log", view: "decisions" },
      { icon: Compass, label: "Tradeoffs", view: "decisions", secondary: true },
    ],
  },
  {
    label: "BUILD",
    items: [
      { icon: LayoutDashboard, label: "PRDs", view: "prds" },
      { icon: CheckSquare, label: "Tasks", view: "tasks" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { icon: Users, label: "Integrations", view: "platform", secondary: true },
      { icon: Users, label: "Platform", view: "platform" },
    ],
  },
];

export function SidebarNav() {
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const { activeView, setActiveView, documents, setDocuments, currentDocId, setCurrentDocId, resetForNewDocument } = useAppStore();
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
          <div className="flex flex-col">
            <span className="font-semibold text-lg tracking-tight">Buildcase</span>
            <span className="label-system text-[11px] normal-case">Product Intelligence Workspace</span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="mt-2 space-y-3 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="label-system px-3 text-[10px] tracking-[0.14em]">{group.label}</p>
            {group.items.map((item) => {
              const isActive = activeView === item.view;
              return (
                <button
                  key={`${group.label}-${item.label}`}
                  className={`relative flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition-all ${isActive ? "bg-white text-primary shadow-sm" : "text-[#5c5a52] hover:bg-white/70 hover:text-foreground"}`}
                  onClick={() => setActiveView(item.view)}
                >
                  {isActive && <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-primary" />}
                  <item.icon className={`h-4 w-4 shrink-0 ${item.secondary ? "opacity-75" : ""}`} />
                  <span className={`${item.secondary ? "opacity-80" : ""}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex-1 flex flex-col min-h-0 mt-3">
        <div className="px-6 py-2.5 flex items-center justify-between group">
          <span className="label-system text-[12px]">
            Workspaces
          </span>
          <button 
            onClick={handleNewDoc}
            disabled={isCreating || !user}
            className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 p-1"
          >
            {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar px-3">
          {documents.map((doc) => {
            const isActive = currentDocId === doc.id;
            return (
              <div 
                key={doc.id}
                className={`group flex items-center gap-2.5 px-3 h-9 cursor-pointer transition-all relative rounded-lg ${
                  isActive ? "bg-white text-primary font-semibold shadow-sm" : "text-[#5c5a52] hover:bg-white/70 hover:text-foreground"
                }`}
                onClick={() => {
                  setCurrentDocId(doc.id);
                  setActiveView("editor");
                }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-primary/60" />
                )}
                <File className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary/70" : "text-muted-foreground/40"}`} />
                <span className="text-xs truncate flex-1">{doc.title}</span>
                <button
                  onClick={(e) => handleDeleteDoc(e, doc.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-primary transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          
          {user && documents.length === 0 && !isCreating && (
            <div className="px-6 py-4">
              <p className="text-[10px] text-muted-foreground/60 italic leading-relaxed">No active documents for this workspace.</p>
            </div>
          )}
        </div>
      </div>

      {/* User Section */}
      <div className="mt-auto border-t border-sidebar-border/80 bg-white/45 backdrop-blur-sm">
        {loading ? (
          <div className="px-6 py-6 h-16 animate-pulse bg-muted/10" />
        ) : user ? (
          <div className="px-6 py-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  width={28}
                  height={28}
                  className="rounded-full shrink-0 ring-1 ring-border/50 shadow-sm"
                />
              ) : (
                <div className="h-7 w-7 rounded-sm bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="label-system text-[12px] leading-none mb-1 normal-case font-semibold text-foreground">
                  {user.displayName || "User"}
                </span>
                <span className="label-system text-[12px] leading-none lowercase">
                  {user.email}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="h-8 flex-1 justify-start label-system text-[12px] hover:text-primary hover:bg-transparent px-0"
                onClick={toggleTheme}
                type="button"
              >
                {isDarkMode ? <SunMedium className="mr-2 h-3.5 w-3.5" /> : <Moon className="mr-2 h-3.5 w-3.5" />}
                {isDarkMode ? "Light Mode" : "Dark Mode"}
              </Button>
              <Button
                variant="ghost"
                className="h-8 flex-1 justify-start label-system text-[12px] hover:text-primary hover:bg-transparent px-0"
                onClick={logout}
                type="button"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-6">
            <Button
              className="w-full h-10 bg-primary text-white hover:bg-primary-hover shadow-sm"
              onClick={loginWithGoogle}
            >
              Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

