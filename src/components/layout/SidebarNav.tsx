"use client";

import { FileText, Lightbulb, CheckSquare, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";

const navItems = [
  { icon: FileText, label: "Editor", active: true },
  { icon: Lightbulb, label: "Insights" },
  { icon: LayoutDashboard, label: "PRDs" },
  { icon: CheckSquare, label: "Tasks" },
];

import Image from "next/image";

import { useAuth } from "@/lib/firebase/AuthProvider";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";

export function SidebarNav() {
  const { user, loginWithGoogle, logout, loading } = useAuth();
  const { isSaving } = useAppStore();

  return (
    <div className="flex h-full flex-col border-r border-border bg-sidebar py-4">
      <div className="px-4 mb-6 flex items-center justify-between">
        <Image 
          src="/logo.png" 
          alt="Buildcase Logo" 
          width={150} 
          height={150} 
          className="h-12 w-auto mix-blend-multiply dark:mix-blend-normal" 
          priority
        />
        {isSaving && (
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full animate-pulse font-medium">
            Saving...
          </span>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item, index) => (
          <Button
            key={index}
            variant={item.active ? "secondary" : "ghost"}
            className="w-full justify-start text-sm"
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="px-2 mt-auto pt-4 border-t border-border/50">
        {!loading && (
          user ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                {user.photoURL ? (
                  <Image src={user.photoURL} alt={user.displayName || "User"} width={20} height={20} className="rounded-full" />
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
                <span className="truncate">{user.displayName || user.email}</span>
              </div>
              <Button variant="ghost" className="w-full justify-start text-xs text-muted-foreground hover:text-foreground" onClick={logout}>
                <LogOut className="mr-2 h-3 w-3" />
                Logout
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full justify-start text-xs border-primary/20 hover:border-primary/50" onClick={loginWithGoogle}>
              <LogIn className="mr-2 h-3 w-3 text-primary" />
              Sign In
            </Button>
          )
        )}
        <div className="mt-4 px-3 text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
          Minimal. AI-First.
        </div>
      </div>
    </div>
  );
}
