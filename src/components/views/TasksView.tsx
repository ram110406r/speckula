"use client";

import React from "react";
import { CheckSquare, Plus, Sparkles, Circle, CheckCircle2, Clock, Loader2, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";

type TaskStatus = "todo" | "in-progress" | "done";
type TaskPriority = "high" | "medium" | "low";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  milestone: string;
}

const priorityConfig: Record<TaskPriority, { label: string; dot: string }> = {
  high: { label: "High", dot: "bg-red-400" },
  medium: { label: "Medium", dot: "bg-yellow-400" },
  low: { label: "Low", dot: "bg-slate-400" },
};

const SAMPLE_TASKS: Task[] = [
  { id: "1", title: "Set up Firebase Auth with Google provider", status: "done", priority: "high", milestone: "Week 1 — Foundation" },
  { id: "2", title: "Build TipTap editor with auto-save to Firestore", status: "done", priority: "high", milestone: "Week 1 — Foundation" },
  { id: "3", title: "Integrate Groq AI streaming API", status: "done", priority: "high", milestone: "Week 1 — Foundation" },
  { id: "4", title: "Connect AI panel with PRD generation prompts", status: "in-progress", priority: "high", milestone: "Week 2 — Intelligence" },
  { id: "5", title: "Build Insights view with category filtering", status: "in-progress", priority: "medium", milestone: "Week 2 — Intelligence" },
  { id: "6", title: "Implement PRD export to PDF/Markdown", status: "todo", priority: "medium", milestone: "Week 3 — Export & Polish" },
  { id: "7", title: "Add document library (multiple docs per user)", status: "todo", priority: "high", milestone: "Week 3 — Export & Polish" },
  { id: "8", title: "Inline AI writing suggestions in editor", status: "todo", priority: "medium", milestone: "Week 4 — AI Enhancement" },
  { id: "9", title: "Collaboration: shared documents via Firestore", status: "todo", priority: "low", milestone: "Phase 2" },
  { id: "10", title: "Linear / Jira integration for task export", status: "todo", priority: "low", milestone: "Phase 2" },
];

const statusOrder: TaskStatus[] = ["todo", "in-progress", "done"];
const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  "todo": { label: "To Do", color: "text-muted-foreground" },
  "in-progress": { label: "In Progress", color: "text-yellow-400" },
  "done": { label: "Done", color: "text-green-400" },
};

export function TasksView() {
  const { setActiveView } = useAppStore();
  const [tasks, setTasks] = React.useState<Task[]>(SAMPLE_TASKS);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState<TaskStatus | "all">("all");

  const toggleStatus = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next: Record<TaskStatus, TaskStatus> = { "todo": "in-progress", "in-progress": "done", "done": "todo" };
      return { ...t, status: next[t.status] };
    }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsGenerating(false);
    setActiveView("editor");
  };

  const filtered = filterStatus === "all" ? tasks : tasks.filter(t => t.status === filterStatus);
  const grouped = statusOrder.reduce<Record<string, Task[]>>((acc, s) => {
    const bucket = filtered.filter(t => t.status === s);
    if (bucket.length > 0) acc[s] = bucket;
    return acc;
  }, {});

  const completedCount = tasks.filter(t => t.status === "done").length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-8 h-14 border-b border-border shrink-0 bg-card/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <h1 className="font-semibold text-sm">Execution Tasks</h1>
          </div>
          {/* Progress pill */}
          <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{completedCount}/{tasks.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-primary/20 hover:border-primary/50 hover:bg-primary/5"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3 w-3 text-primary" />
            )}
            {isGenerating ? "Generating..." : "Suggest with AI"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="mr-1 h-3 w-3" /> Add Task
          </Button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-1 px-8 py-3 border-b border-border/50 shrink-0">
        <ListFilter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
        {(["all", ...statusOrder] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
              filterStatus === s
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All" : statusConfig[s].label}
          </button>
        ))}
      </div>

      {/* Task groups */}
      <div className="flex-1 overflow-auto p-8 space-y-8 max-w-3xl">
        {Object.entries(grouped).map(([status, groupTasks]) => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold uppercase tracking-wider ${statusConfig[status as TaskStatus].color}`}>
                {statusConfig[status as TaskStatus].label}
              </span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{groupTasks.length}</span>
            </div>
            <div className="space-y-2">
              {groupTasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer ${
                    task.status === "done"
                      ? "border-border/50 bg-muted/20 opacity-60"
                      : "border-border bg-card hover:border-border/80"
                  }`}
                  onClick={() => toggleStatus(task.id)}
                >
                  <div className="mt-0.5 shrink-0">
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : task.status === "in-progress" ? (
                      <Clock className="h-4 w-4 text-yellow-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-muted-foreground/60">{task.milestone}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <div className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${priorityConfig[task.priority].dot}`} />
                        <span className="text-[9px] text-muted-foreground/60">{priorityConfig[task.priority].label} priority</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
