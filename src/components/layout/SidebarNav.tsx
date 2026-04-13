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
  Loader2
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
    <div className="flex h-full flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border/50">
        <Image
          src="/logo.png"
          alt="Buildcase Logo"
          width={150}
          height={40}
          className="h-10 w-auto mix-blend-multiply dark:mix-blend-normal"
          priority
        />
      </div>

      {/* Main Navigation */}
      <nav className="p-2 space-y-0.5 mt-2">
        {navItems.map((item) => {
          const isActive = activeView === item.view;
          return (
            <Button
              key={item.view}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start text-sm h-9 px-3 ${
                isActive
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveView(item.view)}
            >
              <item.icon className={`mr-2.5 h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* Documents List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 flex items-center justify-between group">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            My Documents
          </span>
          <button 
            onClick={handleNewDoc}
            disabled={isCreating || !user}
            className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {documents.map((doc) => {
            const isActive = currentDocId === doc.id;
            return (
              <div 
                key={doc.id}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isActive ? "bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                onClick={() => {
                  setCurrentDocId(doc.id);
                  setActiveView("editor");
                }}
              >
                <File className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
                <span className="text-xs truncate flex-1">{doc.title}</span>
                <button
                  onClick={(e) => handleDeleteDoc(e, doc.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          
          {user && documents.length === 0 && !isCreating && (
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] text-muted-foreground italic">No documents yet.</p>
              <Button 
                variant="link" 
                className="text-[10px] h-auto p-0 text-primary"
                onClick={handleNewDoc}
              >
                Create your first
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* User Section */}
      <div className="p-2 border-t border-border/50 bg-background/50">
        {loading ? (
          <div className="h-9 rounded-md bg-muted/30 animate-pulse mx-1" />
        ) : user ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-md">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  width={24}
                  height={24}
                  className="rounded-full shrink-0 ring-1 ring-border"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <UserIcon className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <span className="text-xs text-muted-foreground truncate">
                {user.displayName || user.email}
              </span>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-8 px-3"
              onClick={logout}
            >
              <LogOut className="mr-2 h-3 w-3" />
              Sign Out
            </Button>
          </div>
        ) : (
          <div className="px-1 py-2">
            <Button
              variant="outline"
              className="w-full justify-start text-xs border-primary/20 hover:border-primary/50 hover:bg-primary/5 h-9 px-3"
              onClick={loginWithGoogle}
            >
              <LogIn className="mr-2 h-3 w-3 text-primary" />
              Sign in with Google
            </Button>
          </div>
        )}
        <p className="mt-3 px-3 text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold text-center">
          Minimal. AI-First.
        </p>
      </div>
    </div>
  );
}

