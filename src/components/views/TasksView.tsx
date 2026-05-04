"use client";

import React, { useEffect } from "react";
import { CheckSquare, Plus, Circle, CheckCircle2, Clock, Loader2, ArrowRight, Zap, Users, Trash2, Download, LayoutList, Columns3, CalendarDays, AlertCircle, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useAppStore } from "@/store/useAppStore";
import { getTasks, updateTask, deleteTask, getDocument, type ExecutionTask, getPRDs, type PRD, saveTask } from "@/lib/firebase/db";
import { generateTasksFromPRDAction, analyzeDependenciesAction, intelligentPrioritizeAction } from "@/lib/ai/actions";
import { downloadCSV } from "@/lib/export";
import { toast } from "@/store/useToastStore";
import { exportDialog } from "@/store/useExportDialogStore";
import { activity } from "@/store/useActivityStore";

type TaskStatus = "todo" | "in-progress" | "done";
type TaskPriority = "high" | "medium" | "low";

const priorityConfig: Record<TaskPriority, { label: string; dot: string }> = {
  high: { label: "High", dot: "bg-primary" },
  medium: { label: "Medium", dot: "bg-muted-foreground/50" },
  low: { label: "Low", dot: "bg-muted-foreground/30" },
};

const statusOrder: TaskStatus[] = ["todo", "in-progress", "done"];
const statusConfig: Record<TaskStatus, { label: string; color: string; colBg: string; colBorder: string }> = {
  "todo":        { label: "To do",       color: "text-muted-foreground",    colBg: "bg-muted/20",      colBorder: "border-border/60" },
  "in-progress": { label: "In progress", color: "text-primary",             colBg: "bg-primary/5",     colBorder: "border-primary/30" },
  "done":        { label: "Done",        color: "text-muted-foreground/60", colBg: "bg-muted/10",      colBorder: "border-border/40" },
};

const categoryConfig: Record<string, string> = {
  backend: "#7E43F5",
  frontend: "#9E6BF8",
  design: "#C4A5FA",
  qa: "#5B2FD1",
  integration: "#0891B2",
  devops: "#665AC2",
  general: "#64748B",
};

function formatDueDate(dueDate: string): { text: string; overdue: boolean } {
  const date = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return {
    text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    overdue: date < today,
  };
}

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
  const [viewMode, setViewMode] = React.useState<"list" | "board">("list");
  const [dragOverCol, setDragOverCol] = React.useState<TaskStatus | null>(null);
  const draggedTaskIdRef = React.useRef<string | null>(null);

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
      const tasksWithMetadata = await generateTasksFromPRDAction(prd.content, prd.title);
      const docContent = currentDocId ? (await getDocument(user.uid, currentDocId))?.content || "" : "";
      const deps = await analyzeDependenciesAction(tasksWithMetadata, docContent);
      const prioritizedTasks = await intelligentPrioritizeAction(tasksWithMetadata, deps);
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
    } catch {
      fetchTasks();
    }
  };

  const setTaskStatus = async (task: ExecutionTask, status: TaskStatus) => {
    if (!user || !task.id || task.status === status) return;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
    setSelectedTask(prev => (prev && prev.id === task.id ? { ...prev, status } : prev));
    try {
      await updateTask(user.uid, task.id, { status });
    } catch {
      fetchTasks();
    }
  };

  const setTaskPriority = async (task: ExecutionTask, priority: TaskPriority) => {
    if (!user || !task.id || task.priority === priority) return;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority } : t));
    setSelectedTask(prev => (prev && prev.id === task.id ? { ...prev, priority } : prev));
    try {
      await updateTask(user.uid, task.id, { priority });
    } catch {
      fetchTasks();
    }
  };

  const setTaskDueDate = async (task: ExecutionTask, dueDate: string) => {
    if (!user || !task.id) return;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, dueDate } : t));
    setSelectedTask(prev => (prev && prev.id === task.id ? { ...prev, dueDate } : prev));
    try {
      await updateTask(user.uid, task.id, { dueDate });
    } catch {
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
    } catch {
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
      activity.success("Task created", newTaskTitle.trim());
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setShowNewTask(false);
      await fetchTasks();
    } catch {
      alert("Failed to create task.");
    } finally {
      setIsSavingNew(false);
    }
  };

  // ── Drag-and-drop (board view) ───────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    draggedTaskIdRef.current = taskId;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, col: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== col) setDragOverCol(col);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column element itself (not a child)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverCol(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, col: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = draggedTaskIdRef.current;
    draggedTaskIdRef.current = null;
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) await setTaskStatus(task, col);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filtered = filterStatus === "all" ? tasks : tasks.filter(t => t.status === filterStatus);
  const grouped = statusOrder.reduce<Record<string, ExecutionTask[]>>((acc, s) => {
    const bucket = filtered.filter(t => t.status === s);
    if (bucket.length > 0) acc[s] = bucket;
    return acc;
  }, {});

  const completedCount = tasks.filter(t => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const getBlockingTasks = (task: ExecutionTask): ExecutionTask[] => {
    if (!task.dependsOn || task.dependsOn.length === 0) return [];
    return tasks.filter(t => task.dependsOn?.includes(t.id || ""));
  };

  const handleExportCSV = () => {
    if (tasks.length === 0) { toast.warning("No tasks to export"); return; }
    exportDialog.open({
      defaultFilename: "tasks",
      formats: [{ value: "csv", label: "Spreadsheet (.csv)" }],
      onExport: (filename) => {
        const header = ["Title", "Status", "Priority", "Effort", "Category", "Due Date", "Description"];
        const rows = tasks.map(t => [t.title, t.status, t.priority ?? "", t.effort ?? "", t.category ?? "", t.dueDate ?? "", t.description ?? ""]);
        downloadCSV([header, ...rows], filename);
        toast.success("Tasks exported", `${tasks.length} tasks saved as CSV`);
      },
    });
  };

  // ── Due date badge component ─────────────────────────────────────────────────
  const DueDateBadge = ({ dueDate }: { dueDate: string }) => {
    const { text, overdue } = formatDueDate(dueDate);
    return (
      <span className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
        overdue ? "text-destructive bg-destructive/10" : "text-muted-foreground bg-muted/60"
      }`}>
        <CalendarDays className="h-3 w-3" />
        {overdue && <AlertCircle className="h-2.5 w-2.5" />}
        {text}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background transition-all duration-300">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-3 md:px-8 h-14 border-b border-border/60 shrink-0">
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
          {/* View toggle */}
          <div className="flex items-center rounded-md border border-border/60 overflow-hidden mr-1">
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={`h-8 px-2.5 flex items-center gap-1.5 text-xs transition-colors ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode("board")}
              title="Board view"
              className={`h-8 px-2.5 flex items-center gap-1.5 text-xs transition-colors border-l border-border/60 ${
                viewMode === "board" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={handleGenerateBasic}
            disabled={isGenerating || !currentDocId}
            title={!currentDocId ? "Select a document first" : "Generate from PRD"}
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline ml-1.5">{isGenerating ? "Generating…" : "Generate"}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={handleExportCSV}
            disabled={tasks.length === 0}
            title="Export tasks as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">Export</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setShowNewTask(true)}
            disabled={!currentDocId}
            title={!currentDocId ? "Select a document first" : "New task"}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline ml-1">New task</span>
          </Button>
        </div>
      </div>

      {/* Filter pills — only in list view */}
      {viewMode === "list" && (
        <div className="flex items-center gap-1.5 px-3 md:px-8 py-3 border-b border-border/40 shrink-0 overflow-x-auto">
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
      )}

      {/* ── List view ─────────────────────────────────────────────────────────── */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-y-auto p-3 md:p-10 space-y-6 md:space-y-10 max-w-4xl mx-auto w-full custom-scrollbar">
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
                          ? "border-primary/40 bg-primary/5 hover:border-primary/60"
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
                          <Circle className={`h-4 w-4 ${isBlocked ? "text-primary" : "text-muted-foreground/50"}`} />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                          {isBlocked && (
                            <span className="flex items-center gap-1 text-primary">
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
                          {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
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
      )}

      {/* ── Board view ────────────────────────────────────────────────────────── */}
      {viewMode === "board" && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-0">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading tasks…</span>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-3 gap-0 min-w-[480px] h-full">
              {statusOrder.map((col) => {
                const colTasks = tasks.filter(t => t.status === col);
                const isDragTarget = dragOverCol === col;

                return (
                  <div
                    key={col}
                    onDragOver={(e) => handleDragOver(e, col)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col)}
                    className={`flex flex-col border-r border-border/40 last:border-r-0 transition-colors ${
                      isDragTarget ? "bg-primary/5" : "bg-background"
                    }`}
                  >
                    {/* Column header */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${statusConfig[col].colBorder} shrink-0 ${statusConfig[col].colBg}`}>
                      <span className={`text-xs font-semibold uppercase tracking-[0.07em] ${statusConfig[col].color}`}>
                        {statusConfig[col].label}
                      </span>
                      <span className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${statusConfig[col].colBg} ${statusConfig[col].color}`}>
                        {colTasks.length}
                      </span>
                    </div>

                    {/* Drop zone indicator */}
                    {isDragTarget && (
                      <div className="mx-3 mt-3 h-1.5 rounded-full bg-primary/40 animate-pulse shrink-0" />
                    )}

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                      {colTasks.length === 0 && !isDragTarget && (
                        <div className="flex flex-col items-center justify-center h-24 text-center border border-dashed border-border/40 rounded-lg">
                          <p className="text-xs text-muted-foreground/40">Drop tasks here</p>
                        </div>
                      )}

                      {colTasks.map((task) => {
                        const blockingTasks = getBlockingTasks(task);
                        const isBlocked = blockingTasks.length > 0 && blockingTasks.some(t => t.status !== "done");
                        const isDone = task.status === "done";

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id!)}
                            onClick={() => setSelectedTask(task)}
                            className={`group relative flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all select-none ${
                              isDone
                                ? "border-border/30 bg-muted/20 opacity-60"
                                : isBlocked
                                ? "border-primary/30 bg-primary/5"
                                : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
                            }`}
                          >
                            {/* Drag handle */}
                            <GripVertical className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors cursor-grab active:cursor-grabbing" />

                            <p className={`text-xs font-medium leading-snug pr-5 ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {task.title}
                            </p>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {task.category && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-muted"
                                  style={{ borderLeft: `2px solid ${categoryConfig[task.category] || categoryConfig.general}` }}
                                >
                                  {task.category}
                                </span>
                              )}
                              {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
                              <span className="flex items-center gap-1 ml-auto">
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityConfig[task.priority]?.dot || priorityConfig.medium.dot}`} />
                                <span className="text-[10px] text-muted-foreground">{priorityConfig[task.priority]?.label || "Medium"}</span>
                              </span>
                            </div>

                            {isBlocked && (
                              <span className="flex items-center gap-1 text-[10px] text-primary">
                                <ArrowRight className="h-3 w-3" />
                                Blocked by {blockingTasks.length}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                    <CalendarDays className="h-3.5 w-3.5" /> Due Date
                  </label>
                  <input
                    type="date"
                    value={selectedTask.dueDate ?? ""}
                    onChange={(e) => setTaskDueDate(selectedTask, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  />
                  {selectedTask.dueDate && (() => {
                    const { overdue } = formatDueDate(selectedTask.dueDate);
                    return overdue ? (
                      <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Past due
                      </p>
                    ) : null;
                  })()}
                </div>
                <div>
                  {selectedTask.effort && (
                    <>
                      <label className="text-xs font-semibold text-muted-foreground">Effort</label>
                      <p className="text-sm mt-1">{selectedTask.effort}/10</p>
                    </>
                  )}
                </div>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" /> Assign To
                  </label>
                  <div className="flex items-center gap-2">
                    {selectedTask.assignee && (
                      <button
                        type="button"
                        onClick={() => assignTaskToUser(selectedTask, "")}
                        className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Clear
                      </button>
                    )}
                    {selectedTask.assignee !== user?.email && (
                      <button
                        type="button"
                        onClick={() => assignTaskToUser(selectedTask, user?.email || "")}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Assign to me
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={selectedTask.assignee || ""}
                  onChange={(e) => assignTaskToUser(selectedTask, e.target.value)}
                  placeholder="Name or email…"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
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
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateTask(); }}
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
