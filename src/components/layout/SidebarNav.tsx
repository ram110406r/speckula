"use client";

import { FileText, Lightbulb, CheckSquare, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: FileText, label: "Editor", active: true },
  { icon: Lightbulb, label: "Insights" },
  { icon: LayoutDashboard, label: "PRDs" },
  { icon: CheckSquare, label: "Tasks" },
];

export function SidebarNav() {
  return (
    <div className="flex h-full flex-col border-r border-border bg-sidebar py-4">
      <div className="px-4 mb-8">
        <h1 className="font-semibold text-lg tracking-tight text-primary">Buildcase</h1>
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
      <div className="p-4 mt-auto">
        <div className="text-xs text-muted-foreground">Minimal. AI-First.</div>
      </div>
    </div>
  );
}
