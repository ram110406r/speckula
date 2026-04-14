"use client";

import React, { useEffect } from "react";
import { CheckSquare, Plus, Circle, CheckCircle2, Clock, Loader2, ArrowRight, Zap, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getTasks, updateTask, getDocument, type ExecutionTask, getPRDs, type PRD, saveTask } from "@/lib/firebase/db";
import { generateTasksFromPRDAction, analyzeDependenciesAction, intelligentPrioritizeAction } from "@/lib/ai/actions";

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

const categoryConfig: Record<string, string> = {
  backend: "#3b82f6",
  frontend: "#8b5cf6",
  design: "#ec4899",
  qa: "#f59e0b",
  integration: "#06b6d4",
  devops: "#6366f1",
  general: "#6b7280",
};

export function TasksView() {
  const { user } = useAuth();
  const { currentDocId } = useAppStore();
  const [tasks, setTasks] = React.useState<ExecutionTask[]>([]);
  const [prds, setPRDs] = React.useState<PRD[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState<TaskStatus | "all">("all");
  const [showPRDSelector, setShowPRDSelector] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<ExecutionTask | null>(null);

  const fetchTasks = React.useCallback(async () => {
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
  }, [user]);

  const fetchPRDs = React.useCallback(async () => {
    if (!user) return;
    try {
      const data = await getPRDs(user.uid);
      setPRDs(data);
    } catch (error) {
      console.error("Failed to fetch PRDs:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
    fetchPRDs();
  }, [fetchTasks, fetchPRDs]);

  const handleGenerateFromPRD = async (prd: PRD) => {
    if (!user) return;
    setIsGenerating(true);
    setShowPRDSelector(false);
    
    try {
      // Step 1: Generate tasks from PRD
      const tasksWithMetadata = await generateTasksFromPRDAction(prd.content, prd.title);
      
      // Step 2: Analyze dependencies
      const docContent = currentDocId ? (await getDocument(user.uid, currentDocId))?.content || "" : "";
      const deps = await analyzeDependenciesAction(tasksWithMetadata, docContent);
      
      // Step 3: Intelligently prioritize
      const prioritizedTasks = await intelligentPrioritizeAction(tasksWithMetadata, deps);
      
      // Step 4: Save all tasks to Firestore
      const depMap = new Map<string, string[]>();
      const savedTaskIds: string[] = [];
      const taskRefsToUpdate: Array<{ id: string; dependsOn: string[] }> = [];
      
      // First pass: Save all tasks without dependencies
      for (let i = 0; i < prioritizedTasks.length; i++) {
        const task = prioritizedTasks[i];
        const dep = deps.find(d => d.taskIndex === i);
        
        const docRef = await saveTask(user.uid, {
          ...task,
          status: "todo",
          prdId: prd.id,
          dependsOn: []
        });
        
        savedTaskIds[i] = docRef.id;
        
        // Track dependencies for second pass
        if (dep?.dependsOnIndices.length) {
          taskRefsToUpdate.push({
            id: docRef.id,
            dependsOn: dep.dependsOnIndices.map(idx => savedTaskIds[idx]).filter(Boolean)
          });
        }
      }
      
      // Second pass: Update tasks with correct dependency IDs
      for (const { id, dependsOn } of taskRefsToUpdate) {
        await updateTask(user.uid, id, { dependsOn });
      }
      
      // Log dependency info for debugging
      console.log("Task dependencies mapped:", depMap);
      
      await fetchTasks();
    } catch (error) {
      console.error("Task generation from PRD failed:", error);
      alert("Failed to generate tasks from PRD. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateBasic = async () => {
    if (!user || !currentDocId || isGenerating) return;
    setIsGenerating(true);
    try {
      const doc = await getDocument(user.uid, currentDocId);
      if (!doc || !doc.content) {
        alert("Document is empty. Please add some product notes first.");
        return;
      }
      // Show PRD selector for better task generation with context
      setShowPRDSelector(true);
    } catch (error) {
      console.error("Failed to load document:", error);
      alert("Failed to load document.");
    } finally {
      setIsGenerating(false);
    }
  };

  const assignTaskToUser = async (task: ExecutionTask, assignee: string) => {
    if (!user || !task.id) return;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, assignee } : t));
    try {
      await updateTask(user.uid, task.id, { assignee });
    } catch (error) {
      console.error("Failed to assign task:", error);
      fetchTasks();
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

  // Check for blocked tasks
  const getBlockingTasks = (task: ExecutionTask): ExecutionTask[] => {
    if (!task.dependsOn || task.dependsOn.length === 0) return [];
    return tasks.filter(t => task.dependsOn?.includes(t.id || ""));
  };

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
            <span className="label-system text-[12px]">{progress}% Done</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 label-system text-[12px] hover:text-primary hover:bg-transparent"
            onClick={handleGenerateBasic}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
            {isGenerating ? "Generating..." : "From PRD"}
          </Button>
          <div className="h-4 w-px bg-border/40" />
          <Button size="sm" variant="ghost" className="h-8 label-system text-[12px] hover:text-primary hover:bg-transparent">
            <Plus className="mr-1 h-3.5 w-3.5" /> Manual
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
            <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto leading-relaxed">No tasks yet. Generate an execution matrix from a PRD with AI to begin tracking.</p>
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
              {groupTasks.map((task) => {
                const blockingTasks = getBlockingTasks(task);
                const isBlocked = blockingTasks.length > 0 && blockingTasks.some(t => t.status !== "done");
                
                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-5 p-5 rounded-xl border transition-all duration-300 cursor-pointer group ${
                      task.status === "done"
                        ? "border-border/40 bg-white/5 opacity-50 grayscale hover:grayscale-0"
                        : isBlocked
                        ? "border-yellow-300/50 bg-yellow-50/10 hover:border-yellow-300/80"
                        : "border-border bg-white shadow-sm hover:border-primary/40 hover:shadow-md"
                    }`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="mt-0.5 shrink-0 transition-transform group-active:scale-90">
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : task.status === "in-progress" ? (
                        <Clock className="h-5 w-5 text-primary animate-pulse" />
                      ) : (
                        <Circle className={`h-5 w-5 ${isBlocked ? "text-yellow-500" : "text-muted-foreground/30 group-hover:text-primary/40"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-snug tracking-tight ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {isBlocked && (
                          <div className="flex items-center gap-1.5 text-xs text-yellow-600 bg-yellow-100/50 px-2 py-0.5 rounded">
                            <ArrowRight className="h-3 w-3" />
                            Blocked by {blockingTasks.length}
                          </div>
                        )}
                        {task.category && (
                          <div className="label-system text-[11px] px-2 py-0.5 rounded bg-muted/30" style={{ borderLeft: `2px solid ${categoryConfig[task.category] || categoryConfig.general}` }}>
                            {task.category}
                          </div>
                        )}
                        {task.effort && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1 w-8 bg-border/40 rounded-full overflow-hidden">
                              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(task.effort / 10) * 100}%` }} />
                            </div>
                            <span className="label-system text-[11px] text-muted-foreground">{task.effort}e</span>
                          </div>
                        )}
                        {task.milestone && (
                          <div className="label-system text-[12px] lowercase opacity-80">{task.milestone}</div>
                        )}
                        <div className="flex items-center gap-2 ml-auto px-2 py-0.5 rounded-sm bg-muted/20">
                          <span className={`h-1.5 w-1.5 rounded-full ${priorityConfig[task.priority]?.dot || priorityConfig.medium.dot}`} />
                          <span className="label-system text-[12px]">{priorityConfig[task.priority]?.label || "Medium"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* PRD Selector Dialog */}
      <Dialog open={showPRDSelector} onOpenChange={setShowPRDSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select PRD</DialogTitle>
            <DialogDescription>Choose a PRD to generate tasks from</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {prds.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No PRDs available. Create a PRD first in the PRDs view.</p>
            ) : (
              prds.map(prd => (
                <button
                  key={prd.id}
                  onClick={() => handleGenerateFromPRD(prd)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <p className="font-medium text-sm">{prd.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{prd.content.slice(0, 100)}...</p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Popover */}
      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedTask.title}</DialogTitle>
              <DialogDescription>{selectedTask.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedTask.description && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Description</label>
                  <p className="text-sm mt-1">{selectedTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                  <p className="text-sm mt-1 capitalize">{selectedTask.priority}</p>
                </div>
                {selectedTask.effort && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Effort</label>
                    <p className="text-sm mt-1">{selectedTask.effort}/10</p>
                  </div>
                )}
              </div>
              {selectedTask.category && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Category</label>
                  <p className="text-sm mt-1 capitalize">{selectedTask.category}</p>
                </div>
              )}
              {selectedTask.prdSection && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">PRD Section</label>
                  <p className="text-sm mt-1">{selectedTask.prdSection}</p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-2">
                  <Users className="h-3.5 w-3.5" /> Assign To
                </label>
                <select
                  value={selectedTask.assignee || ""}
                  onChange={(e) => assignTaskToUser(selectedTask, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="">Unassigned</option>
                  <option value={user?.email || ""}>{user?.email || "You"}</option>
                </select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
