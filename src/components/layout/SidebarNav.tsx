"use client";

import Image from "next/image";
import { FileText, Lightbulb, CheckSquare, LayoutDashboard, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";

const navItems = [
  { icon: FileText, label: "Editor", active: true },
  { icon: Lightbulb, label: "Insights" },
  { icon: LayoutDashboard, label: "PRDs" },
  { icon: CheckSquare, label: "Tasks" },
];

export function SidebarNav() {
  const { user, loginWithGoogle, logout, loading } = useAuth();

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

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 mt-2">
        {navItems.map((item, index) => (
          <Button
            key={index}
            variant={item.active ? "secondary" : "ghost"}
            className={`w-full justify-start text-sm h-9 px-3 ${
              item.active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
            {item.label}
          </Button>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-2 border-t border-border/50 mt-auto">
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
          <Button
            variant="outline"
            className="w-full justify-start text-xs border-primary/20 hover:border-primary/50 hover:bg-primary/5 h-9 px-3"
            onClick={loginWithGoogle}
          >
            <LogIn className="mr-2 h-3 w-3 text-primary" />
            Sign in with Google
          </Button>
        )}
        <p className="mt-3 px-3 text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
          Minimal. AI-First.
        </p>
      </div>
    </div>
  );
}
