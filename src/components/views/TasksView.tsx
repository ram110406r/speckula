"use client";

import React, { useEffect } from "react";
import { CheckSquare, Plus, Circle, CheckCircle2, Clock, Loader2, ArrowRight, Zap, Users, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getTasks, updateTask, deleteTask, getDocument, type ExecutionTask, getPRDs, type PRD, saveTask } from "@/lib/firebase/db";
import { generateTasksFromPRDAction, analyzeDependenciesAction, intelligentPrioritizeAction } from "@/lib/ai/actions";

type TaskStatus = "todo" | "in-progress" | "done";
type TaskPriority = "high" | "medium" | "low";

const priorityConfig: Record<TaskPriority, { label: string; dot: string }> = {
  high: { label: "High", dot: "bg-primary" },
  medium: { label: "Medium", dot: "bg-muted-foreground/50" },
  low: { label: "Low", dot: "bg-muted-foreground/30" },
};

const statusOrder: TaskStatus[] = ["todo", "in-progress", "done"];
const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  "todo": { label: "To do", color: "text-muted-foreground" },
  "in-progress": { label: "In progress", color: "text-primary" },
  "done": { label: "Done", color: "text-muted-foreground/60" },
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
  const [showNewTask, setShowNewTask] = React.useState(false);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskDescription, setNewTaskDescription] = React.useState("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<TaskPriority>("medium");
  const [isSavingNew, setIsSavingNew] = React.useState(false);

  const fetchTasks = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getTasks(user.uid);
      setTasks(currentDocId ? data.filter((task) => task.sourceDocId === currentDocId) : []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentDocId]);

  const fetchPRDs = React.useCallback(async () => {
    if (!user) return;
    try {
      const data = await getPRDs(user.uid);
      setPRDs(currentDocId ? data.filter((prd) => prd.sourceDocId === currentDocId) : []);
    } catch (error) {
      console.error("Failed to fetch PRDs:", error);
    }
  }, [user, currentDocId]);

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
      
      // Step 4: Save all tasks to Firestore in two passes.
      //
      // First pass: persist every task with `dependsOn: []` so all of them
      // exist before we reference each other. Forward dependencies (a task
      // whose dep index is greater than its own position) require this —
      // the previous one-pass approach silently dropped them because the
      // dependent's persisted id wasn't yet known when we tried to read it.
      const savedTaskIds: string[] = new Array(prioritizedTasks.length);
      for (let i = 0; i < prioritizedTasks.length; i++) {
        const task = prioritizedTasks[i];
        const docRef = await saveTask(user.uid, {
          ...task,
          status: "todo",
          prdId: prd.id,
          sourceDocId: currentDocId ?? undefined,
          dependsOn: [],
        });
        savedTaskIds[i] = docRef.id;
      }

      // Second pass: now that all ids are known, resolve dependencies in
      // both directions. Bounds-check dep indices against tasks length so
      // a model returning a stray index doesn't cause an "undefined" id
      // to leak into Firestore.
      for (let i = 0; i < prioritizedTasks.length; i++) {
        const dep = deps.find((d) => d.taskIndex === i);
        if (!dep?.dependsOnIndices?.length) continue;
        const dependsOn = dep.dependsOnIndices
          .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < prioritizedTasks.length && idx !== i)
          .map((idx) => savedTaskIds[idx])
          .filter(Boolean);
        if (dependsOn.length > 0) {
          await updateTask(user.uid, savedTaskIds[i], { dependsOn });
        }
      }

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
    setSelectedTask(prev => (prev && prev.id === task.id ? { ...prev, assignee } : prev));
    try {
      await updateTask(user.uid, task.id, { assignee });
    } catch (error) {
      console.error("Failed to assign task:", error);
      fetchTasks();
    }
  };

  const setTaskStatus = async (task: ExecutionTask, status: TaskStatus) => {
    if (!user || !task.id || task.status === status) return;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    setSelectedTask(prev => (prev && prev.id === task.id ? { ...prev, status } : prev));
    try {
      await updateTask(user.uid, task.id, { status });
    } catch (error) {
      console.error("Failed to update status:", error);
      fetchTasks();
    }
  };

  const setTaskPriority = async (task: ExecutionTask, priority: TaskPriority) => {
    if (!user || !task.id || task.priority === priority) return;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority } : t));
    setSelectedTask(prev => (prev && prev.id === task.id ? { ...prev, priority } : prev));
    try {
      await updateTask(user.uid, task.id, { priority });
    } catch (error) {
      console.error("Failed to update priority:", error);
      fetchTasks();
    }
  };

  const cycleStatus = (task: ExecutionTask) => {
    const next: Record<TaskStatus, TaskStatus> = {
      "todo": "in-progress",
      "in-progress": "done",
      "done": "todo",
    };
    setTaskStatus(task, next[task.status]);
  };

  const handleDeleteTask = async (task: ExecutionTask) => {
    if (!user || !task.id) return;
    if (!confirm(`Delete task "${task.title}"?`)) return;
    const taskId = task.id;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
    try {
      await deleteTask(user.uid, taskId);
    } catch (error) {
      console.error("Failed to delete task:", error);
      alert("Failed to delete task.");
      fetchTasks();
    }
  };

  const handleCreateTask = async () => {
    if (!user || !newTaskTitle.trim() || isSavingNew) return;
    setIsSavingNew(true);
    try {
      await saveTask(user.uid, {
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        status: "todo",
        priority: newTaskPriority,
        sourceDocId: currentDocId ?? undefined,
        dependsOn: [],
      });
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setShowNewTask(false);
      await fetchTasks();
    } catch (error) {
      console.error("Failed to create task:", error);
      alert("Failed to create task.");
    } finally {
      setIsSavingNew(false);
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
      <div className="flex items-center justify-between px-8 h-14 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Tasks</span>
          </div>
          <div className="h-4 w-px bg-border/40" />
          <div className="flex items-center gap-2.5">
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{progress}% done</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={handleGenerateBasic}
            disabled={isGenerating || !currentDocId}
            title={!currentDocId ? "Select a document first" : undefined}
          >
            {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
            {isGenerating ? "Generating…" : "Generate from PRD"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setShowNewTask(true)}
            disabled={!currentDocId}
            title={!currentDocId ? "Select a document first" : undefined}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> New task
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-8 py-3 border-b border-border/40 shrink-0">
        {(["all", ...statusOrder] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filterStatus === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {s === "all" ? "All" : statusConfig[s].label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-10 max-w-4xl mx-auto w-full custom-scrollbar">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-20 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading tasks…</span>
          </div>
        )}

        {!isLoading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border/60 rounded-xl max-w-lg mx-auto">
            <CheckSquare className="h-8 w-8 text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium mb-1">No tasks yet</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">Generate tasks from a PRD to get started.</p>
          </div>
        )}

        {!isLoading && tasks.length > 0 && Object.entries(grouped).map(([status, groupTasks]) => (
          <div key={status}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-xs font-medium uppercase tracking-[0.06em] ${statusConfig[status as TaskStatus].color}`}>
                {statusConfig[status as TaskStatus].label}
              </span>
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-xs text-muted-foreground">{groupTasks.length}</span>
            </div>
            <div className="space-y-2">
              {groupTasks.map((task) => {
                const blockingTasks = getBlockingTasks(task);
                const isBlocked = blockingTasks.length > 0 && blockingTasks.some(t => t.status !== "done");
                const isDone = task.status === "done";

                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      isDone
                        ? "border-border/40 bg-transparent opacity-60 hover:opacity-100"
                        : isBlocked
                        ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); cycleStatus(task); }}
                      title={`Mark ${task.status === "todo" ? "in progress" : task.status === "in-progress" ? "done" : "to do"}`}
                      className="mt-0.5 shrink-0 rounded-md p-0.5 -m-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : task.status === "in-progress" ? (
                        <Clock className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className={`h-4 w-4 ${isBlocked ? "text-amber-500" : "text-muted-foreground/50"}`} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                        {isBlocked && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <ArrowRight className="h-3 w-3" />
                            Blocked by {blockingTasks.length}
                          </span>
                        )}
                        {task.category && (
                          <span className="px-1.5 py-0.5 rounded bg-muted" style={{ borderLeft: `2px solid ${categoryConfig[task.category] || categoryConfig.general}` }}>
                            {task.category}
                          </span>
                        )}
                        {task.effort && (
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-1 w-8 bg-border/60 rounded-full overflow-hidden">
                              <span className="block h-full bg-primary/60" style={{ width: `${(task.effort / 10) * 100}%` }} />
                            </span>
                            <span>effort {task.effort}</span>
                          </span>
                        )}
                        {task.milestone && <span>{task.milestone}</span>}
                        <span className="flex items-center gap-1.5 ml-auto">
                          <span className={`h-1.5 w-1.5 rounded-full ${priorityConfig[task.priority]?.dot || priorityConfig.medium.dot}`} />
                          <span>{priorityConfig[task.priority]?.label || "Medium"}</span>
                        </span>
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

      {/* Task Detail Dialog */}
      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedTask.title}</DialogTitle>
              <DialogDescription className="sr-only">Task details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedTask.description && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Description</label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Status</label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => setTaskStatus(selectedTask, e.target.value as TaskStatus)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  >
                    {statusOrder.map(s => (
                      <option key={s} value={s}>{statusConfig[s].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) => setTaskPriority(selectedTask, e.target.value as TaskPriority)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  >
                    {(["high", "medium", "low"] as TaskPriority[]).map(p => (
                      <option key={p} value={p}>{priorityConfig[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {selectedTask.effort && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Effort</label>
                    <p className="text-sm mt-1">{selectedTask.effort}/10</p>
                  </div>
                )}
                {selectedTask.category && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Category</label>
                    <p className="text-sm mt-1 capitalize">{selectedTask.category}</p>
                  </div>
                )}
              </div>
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
            <DialogFooter className="justify-between sm:justify-between">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDeleteTask(selectedTask)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTask(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={(open) => { if (!open) { setShowNewTask(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Create a task in the current document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Title</label>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Optional details"
                rows={3}
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Priority</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
              >
                {(["high", "medium", "low"] as TaskPriority[]).map(p => (
                  <option key={p} value={p}>{priorityConfig[p].label}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setShowNewTask(false)} disabled={isSavingNew}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateTask} disabled={!newTaskTitle.trim() || isSavingNew || !user}>
              {isSavingNew ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
