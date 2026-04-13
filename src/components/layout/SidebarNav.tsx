import React, { useEffect } from "react";
import Image from "next/image";
import { 
  FileText, 
  Lightbulb, 
  CheckSquare, 
  LayoutDashboard, 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  Plus, 
  File,
  Trash2,
  Loader2,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore, type AppView } from "@/store/useAppStore";
import { getUserDocuments, createDocument, deleteDocument } from "@/lib/firebase/db";

const navItems: { icon: React.ElementType; label: string; view: AppView }[] = [
  { icon: FileText, label: "Editor", view: "editor" },
  { icon: Lightbulb, label: "Insights", view: "insights" },
  { icon: LayoutDashboard, label: "PRDs", view: "prds" },
  { icon: CheckSquare, label: "Tasks", view: "tasks" },
];

export function SidebarNav() {
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const { activeView, setActiveView, documents, setDocuments, currentDocId, setCurrentDocId } = useAppStore();
  const [isCreating, setIsCreating] = React.useState(false);

  // Sync Documents from Firestore
  useEffect(() => {
    if (!user) {
      setDocuments([]);
      return;
    }

    const fetchDocs = async () => {
      const docs = await getUserDocuments(user.uid);
      setDocuments(docs);
      
      // Auto-select first doc if none selected
      if (docs.length > 0 && !currentDocId) {
        setCurrentDocId(docs[0].id);
      }
    };

    fetchDocs();
  }, [user, setDocuments, currentDocId, setCurrentDocId]);

  const handleNewDoc = async () => {
    if (!user || isCreating) return;
    setIsCreating(true);
    try {
      const newId = await createDocument(user.uid);
      const docs = await getUserDocuments(user.uid);
      setDocuments(docs);
      setCurrentDocId(newId);
      setActiveView("editor");
    } catch (error) {
      console.error("Failed to create document:", error);
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
        setCurrentDocId(docs.length > 0 ? docs[0].id : null);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-background transition-colors duration-300">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border/60 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shadow-sm">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">Buildcase</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              className={`w-full flex items-center h-11 px-6 text-sm transition-all relative ${
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/10 font-medium"
              }`}
              onClick={() => setActiveView(item.view)}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary animate-in fade-in slide-in-from-left-1 duration-300" />
              )}
              <item.icon className={`mr-3 h-4 w-4 shrink-0`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Documents List */}
      <div className="flex-1 flex flex-col min-h-0 mt-8">
        <div className="px-6 py-3 flex items-center justify-between group">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
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
        
        <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
          {documents.map((doc) => {
            const isActive = currentDocId === doc.id;
            return (
              <div 
                key={doc.id}
                className={`group flex items-center gap-2.5 px-6 h-9 cursor-pointer transition-all relative ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground/80 hover:bg-muted/10 hover:text-foreground"
                }`}
                onClick={() => {
                  setCurrentDocId(doc.id);
                  setActiveView("editor");
                }}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/60" />
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
      <div className="mt-auto border-t border-border/60 bg-white/30 backdrop-blur-sm">
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
                <span className="text-[11px] font-bold text-foreground truncate leading-none mb-1">
                  {user.displayName || "User"}
                </span>
                <span className="text-[10px] text-muted-foreground truncate leading-none">
                  {user.email}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="h-8 flex-1 justify-start text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-transparent px-0"
                onClick={logout}
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

