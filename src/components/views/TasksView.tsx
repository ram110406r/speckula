"use client";

import React, { useEffect } from "react";
import { CheckSquare, Plus, Sparkles, Circle, CheckCircle2, Clock, Loader2, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getTasks, updateTask, getDocument, type ExecutionTask } from "@/lib/firebase/db";
import { suggestTasksAction } from "@/lib/ai/actions";

type TaskStatus = "todo" | "in-progress" | "done";
type TaskPriority = "high" | "medium" | "low";

const priorityConfig: Record<TaskPriority, { label: string; dot: string }> = {
  high: { label: "High", dot: "bg-red-400" },
  medium: { label: "Medium", dot: "bg-yellow-400" },
  low: { label: "Low", dot: "bg-slate-400" },
};

const statusOrder: TaskStatus[] = ["todo", "in-progress", "done"];
const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  "todo": { label: "To Do", color: "text-muted-foreground" },
  "in-progress": { label: "In Progress", color: "text-yellow-400" },
  "done": { label: "Done", color: "text-green-400" },
};

export function TasksView() {
  const { user } = useAuth();
  const { setActiveView, currentDocId } = useAppStore();
  const [tasks, setTasks] = React.useState<ExecutionTask[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState<TaskStatus | "all">("all");

  const fetchTasks = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getTasks(user.uid);
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const toggleStatus = async (task: ExecutionTask) => {
    if (!user || !task.id) return;
    const next: Record<TaskStatus, TaskStatus> = { "todo": "in-progress", "in-progress": "done", "done": "todo" };
    const nextStatus = next[task.status];
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    
    try {
      await updateTask(user.uid, task.id, { status: nextStatus });
    } catch (error) {
      console.error("Failed to toggle status:", error);
      fetchTasks(); // Revert on failure
    }
  };

  const handleGenerate = async () => {
    if (!user || !currentDocId || isGenerating) return;
    setIsGenerating(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !doc.content) {
        alert("Document is empty. Please add some notes first.");
        return;
      }
      await suggestTasksAction(user.uid, doc.content);
      await fetchTasks();
    } catch (error) {
      console.error("Task suggestion failed:", error);
      alert("AI task generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const filtered = filterStatus === "all" ? tasks : tasks.filter(t => t.status === filterStatus);
  const grouped = statusOrder.reduce<Record<string, ExecutionTask[]>>((acc, s) => {
    const bucket = filtered.filter(t => t.status === s);
    if (bucket.length > 0) acc[s] = bucket;
    return acc;
  }, {});

  const completedCount = tasks.filter(t => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-8 h-14 border-b border-border shrink-0 bg-card/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <h1 className="font-semibold text-sm text-foreground">Execution Tasks</h1>
          </div>
          {/* Progress pill */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1">
            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
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
            disabled={isGenerating || !currentDocId}
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
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CheckSquare className="h-10 w-10 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground">No tasks trackers yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Generate an execution plan from your product notes with AI.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([status, groupTasks]) => (
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
                    onClick={() => toggleStatus(task)}
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
                        {task.milestone && <span className="text-[9px] text-muted-foreground/60">{task.milestone}</span>}
                        <span className="text-muted-foreground/30">·</span>
                        <div className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${priorityConfig[task.priority]?.dot || priorityConfig.medium.dot}`} />
                          <span className="text-[9px] text-muted-foreground/60">{priorityConfig[task.priority]?.label || "Medium"} priority</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

