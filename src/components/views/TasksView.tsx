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
  high: { label: "High Priority", dot: "bg-primary" },
  medium: { label: "Mid Priority", dot: "bg-muted-foreground/40" },
  low: { label: "Low Priority", dot: "bg-muted-foreground/20" },
};

const statusOrder: TaskStatus[] = ["todo", "in-progress", "done"];
const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  "todo": { label: "Awaiting", color: "text-muted-foreground" },
  "in-progress": { label: "Active", color: "text-primary" },
  "done": { label: "Resolved", color: "text-primary/40" },
};

export function TasksView() {
  const { user } = useAuth();
  const { currentDocId } = useAppStore();
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
    
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    
    try {
      await updateTask(user.uid, task.id, { status: nextStatus });
    } catch (error) {
      console.error("Failed to toggle status:", error);
      fetchTasks();
    }
  };

  const handleGenerate = async () => {
    if (!user || !currentDocId || isGenerating) return;
    setIsGenerating(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !doc.content) {
        alert("Document is empty. Please add some product notes first.");
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
    <div className="flex flex-col h-full bg-background transition-all duration-300">
      <div className="flex items-center justify-between px-8 h-14 border-b border-border/60 shrink-0 bg-white/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="label-system text-[12px]">Task Matrix</span>
          </div>
          <div className="h-4 w-px bg-border/40" />
          <div className="flex items-center gap-3">
            <div className="w-24 h-1.5 bg-border/40 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <span className="label-system text-[12px]">{progress}% Completion</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 label-system text-[12px] hover:text-primary hover:bg-transparent"
            onClick={handleGenerate}
            disabled={isGenerating || !currentDocId}
          >
            {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {isGenerating ? "Mapping..." : "Plan with AI"}
          </Button>
          <div className="h-4 w-px bg-border/40" />
          <Button size="sm" variant="ghost" className="h-8 label-system text-[12px] hover:text-primary hover:bg-transparent">
            <Plus className="mr-1 h-3.5 w-3.5" /> Force Entry
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-8 py-4 border-b border-border/40 shrink-0 bg-white/10">
        {(["all", ...statusOrder] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-md label-system text-[12px] transition-all border ${
              filterStatus === s
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white border-border/60 hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {s === "all" ? "Full Registry" : statusConfig[s].label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-12 max-w-4xl custom-scrollbar">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary/20" />
            <span className="label-system text-[12px] animate-pulse">Syncing Master Backlog</span>
          </div>
        )}

        {!isLoading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center p-20 text-center border-2 border-dashed border-border/40 rounded-2xl max-w-2xl mx-auto">
            <CheckSquare className="h-10 w-10 text-muted-foreground/20 mb-6" />
            <p className="label-system text-[12px] mb-2">Baseline Zero</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto leading-relaxed"> No tasks trackers yet. Generate an execution matrix from your product notes with AI to begin tracking.</p>
          </div>
        )}

        {!isLoading && tasks.length > 0 && Object.entries(grouped).map(([status, groupTasks]) => (
          <div key={status} className="animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6">
              <span className={`label-system text-[12px] ${statusConfig[status as TaskStatus].color}`}>
                {statusConfig[status as TaskStatus].label}
              </span>
              <div className="h-px flex-1 bg-border/40" />
              <span className="label-system text-[12px] bg-muted/20 px-1.5 py-0.5 rounded-sm">{groupTasks.length}</span>
            </div>
            <div className="space-y-3">
              {groupTasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-5 p-5 rounded-xl border transition-all duration-300 cursor-pointer group ${
                    task.status === "done"
                      ? "border-border/40 bg-white/5 opacity-50 grayscale hover:grayscale-0"
                      : "border-border bg-white shadow-sm hover:border-primary/40 hover:shadow-md"
                  }`}
                  onClick={() => toggleStatus(task)}
                >
                  <div className="mt-0.5 shrink-0 transition-transform group-active:scale-90">
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : task.status === "in-progress" ? (
                      <Clock className="h-5 w-5 text-primary animate-pulse" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-snug tracking-tight ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      {task.milestone && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 w-1 rounded-full bg-border" />
                          <span className="label-system text-[12px] lowercase opacity-80">{task.milestone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 px-2 py-0.5 rounded-sm bg-muted/20">
                        <span className={`h-1.5 w-1.5 rounded-full ${priorityConfig[task.priority]?.dot || priorityConfig?.medium?.dot || 'bg-muted'}`} />
                        <span className="label-system text-[12px]">{priorityConfig[task.priority]?.label || "Medium"}</span>
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
