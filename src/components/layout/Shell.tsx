"use client";

import React from "react";
import { useAppStore } from "@/store/useAppStore";
import dynamic from "next/dynamic";
const Editor              = dynamic(() => import("@/components/editor/Editor").then(m => ({ default: m.Editor })), { ssr: false });
const AIPanel             = dynamic(() => import("@/components/ai/AIPanel").then(m => ({ default: m.AIPanel })), { ssr: false });
// INTELLIGENCE
const InsightsView        = dynamic(() => import("../views/InsightsView").then(m => ({ default: m.InsightsView })), { ssr: false });
const CompetitorsView     = dynamic(() => import("../views/CompetitorsView").then(m => ({ default: m.CompetitorsView })), { ssr: false });
const ProductBrainView    = dynamic(() => import("../views/ProductBrainView").then(m => ({ default: m.ProductBrainView })), { ssr: false });
// DECISION ENGINE
const PRDsView            = dynamic(() => import("../views/PRDsView").then(m => ({ default: m.PRDsView })), { ssr: false });
const DecisionView        = dynamic(() => import("../views/DecisionView").then(m => ({ default: m.DecisionView })), { ssr: false });
const RoadmapsView        = dynamic(() => import("../views/RoadmapsView").then(m => ({ default: m.RoadmapsView })), { ssr: false });
const ExperimentsView     = dynamic(() => import("../views/ExperimentsView").then(m => ({ default: m.ExperimentsView })), { ssr: false });
// EXECUTION
const TasksView           = dynamic(() => import("../views/TasksView").then(m => ({ default: m.TasksView })), { ssr: false });
const PlatformView        = dynamic(() => import("../views/PlatformView").then(m => ({ default: m.PlatformView })), { ssr: false });
const SlackView           = dynamic(() => import("../views/SlackView").then(m => ({ default: m.SlackView })), { ssr: false });
// AI SYSTEMS
const AutonomousModeView  = dynamic(() => import("../views/AutonomousModeView").then(m => ({ default: m.AutonomousModeView })), { ssr: false });
const AgentsView          = dynamic(() => import("../views/AgentsView").then(m => ({ default: m.AgentsView })), { ssr: false });
const ActivityView        = dynamic(() => import("../views/ActivityView").then(m => ({ default: m.ActivityView })), { ssr: false });
// HOME
const WorkspaceView       = dynamic(() => import("../views/WorkspaceView").then(m => ({ default: m.WorkspaceView })), { ssr: false });
const DashboardView       = dynamic(() => import("../views/DashboardView").then(m => ({ default: m.DashboardView })), { ssr: false });
// PLATFORM
const NotificationsView   = dynamic(() => import("../views/NotificationsView").then(m => ({ default: m.NotificationsView })), { ssr: false });
const ExtensionView       = dynamic(() => import("../views/ExtensionView").then(m => ({ default: m.ExtensionView })), { ssr: false });
const ProfileView         = dynamic(() => import("../views/ProfileView").then(m => ({ default: m.ProfileView })), { ssr: false });
const HelpView            = dynamic(() => import("../views/HelpView").then(m => ({ default: m.HelpView })), { ssr: false });
const SettingsView        = dynamic(() => import("../views/SettingsView").then(m => ({ default: m.SettingsView })), { ssr: false });
import { ModernSidebar } from "@/components/ui/modern-side-bar";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { LandingPage } from "./LandingPage";
import { Loader2, Sparkles, ChevronRight, CheckCircle2 } from "lucide-react";
import type { AppView } from "@/store/useAppStore";
import { toast } from "@/store/useToastStore";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatRelativeActivity(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const maybeTimestamp = value as { toDate?: () => Date };
  const date = typeof maybeTimestamp.toDate === "function" ? maybeTimestamp.toDate() : null;
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

// Phase breadcrumb ─────────────────────────────────────────────────────────────

interface Phase {
  label: string;
  entry: AppView; // the view to navigate to on click
  views: AppView[];
}

interface PhaseWithContent extends Phase {
  contentKey?: "insights" | "decisions" | "prds";
}

const PHASES: PhaseWithContent[] = [
  { label: "Evidence", entry: "editor", views: ["editor", "market-intelligence"], contentKey: "insights" },
  { label: "Argument", entry: "decisions", views: ["decisions"], contentKey: "decisions" },
  { label: "Verdict", entry: "specifications", views: ["specifications", "tasks"], contentKey: "prds" },
];

function PhaseBreadcrumb({
  activeView,
  setActiveView,
}: {
  activeView: AppView;
  setActiveView: (v: AppView) => void;
}) {
  const { phaseHasContent } = useAppStore();
  const activePhaseIndex = PHASES.findIndex((p) => p.views.includes(activeView));

  return (
    <nav
      className="hidden sm:flex items-center gap-0.5"
      aria-label="Workflow phases"
    >
      {PHASES.map((phase, i) => {
        const isActive = i === activePhaseIndex;
        const isPast = i < activePhaseIndex;
        const isLast = i === PHASES.length - 1;
        const hasContent = phase.contentKey ? phaseHasContent[phase.contentKey] : false;

        return (
          <React.Fragment key={phase.label}>
            <button
              type="button"
              onClick={() => setActiveView(phase.entry)}
              className={`
                flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150
                ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : isPast
                    ? "text-foreground/70 hover:text-foreground hover:bg-muted/50"
                    : "text-muted-foreground hover:text-foreground/70 hover:bg-muted/30"
                }
              `}
            >
              <span className={`font-mono text-[10px] uppercase tracking-[0.06em] ${
                isActive ? "font-semibold" : ""
              }`}>
                {phase.label}
              </span>
              {hasContent && (
                <CheckCircle2 className={`h-2.5 w-2.5 shrink-0 ${isActive ? "text-primary" : "text-success"}`} />
              )}
            </button>
            {!isLast && (
              <ChevronRight
                className={`h-3 w-3 shrink-0 ${
                  isPast ? "text-foreground/40" : "text-border"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function Shell() {
  const { user, loading } = useAuth();
  const { aiPanelOpen, toggleAiPanel, activeView, setActiveView, documents, currentDocId } =
    useAppStore();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  // Track whether Autonomous Mode has ever been visited so we can keep it
  // mounted (but hidden) instead of unmounting on navigation, preserving state.
  const [autonomousMounted, setAutonomousMounted] = React.useState(false);
  React.useEffect(() => {
    if (activeView === "autonomous") setAutonomousMounted(true);
  }, [activeView]);

  // True when viewport is >= lg (1024px). Initialised synchronously from
  // window so there is no flash on client-only renders. Used to ensure only
  // one <AIPanel> instance is ever mounted at a time (desktop column vs mobile
  // overlay) — two concurrent instances would fire duplicate analysis timers.
  const [isDesktopPanel, setIsDesktopPanel] = React.useState<boolean>(
    () => typeof window !== "undefined" ? window.innerWidth >= 1024 : false
  );
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktopPanel(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Handle Slack OAuth redirect params (?slack=connected|denied|error).
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slack = params.get("slack");
    if (!slack) return;
    window.history.replaceState({}, "", window.location.pathname);
    setActiveView("integrations");
    if (slack === "connected") {
      toast.success("Slack connected", "Your workspace is now syncing to SPECKULA.");
    } else if (slack === "denied") {
      toast.warning("Slack connection cancelled", "You can connect Slack any time from the Integrations page.");
    } else if (slack === "error") {
      toast.error("Slack connection failed", "Something went wrong. Please try again.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspace
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const currentDoc = documents.find((doc) => doc.id === currentDocId);
  const activityText = formatRelativeActivity(currentDoc?.updatedAt);

  const renderMainView = () => {
    const wrap = (name: string, node: React.ReactNode) => (
      <ViewErrorBoundary viewName={name}>{node}</ViewErrorBoundary>
    );
    switch (activeView) {
      // HOME
      case "workspace":          return wrap("Workspace",         <WorkspaceView />);
      case "dashboard":          return wrap("Dashboard",         <DashboardView />);
      // INTELLIGENCE
      case "market-intelligence":return wrap("Market Intelligence",<InsightsView />);
      case "competitors":        return wrap("Competitors",        <CompetitorsView />);
      case "product-brain":      return wrap("Product Brain",      <ProductBrainView />);
      // DECISION ENGINE
      case "decisions":          return wrap("Decisions",         <DecisionView />);
      case "specifications":     return wrap("Specifications",    <PRDsView />);
      case "roadmaps":           return wrap("Roadmaps",          <RoadmapsView />);
      case "experiments":        return wrap("Experiments",       <ExperimentsView />);
      // EXECUTION
      case "tasks":              return wrap("Tasks",             <TasksView />);
      case "projects":           return wrap("Projects",          <PlatformView />);
      case "integrations":       return wrap("Integrations",      <SlackView />);
      // AI SYSTEMS
      case "agents":             return wrap("Agents",            <AgentsView />);
      case "activity":           return wrap("Activity",          <ActivityView />);
      // PLATFORM
      case "notifications":      return wrap("Notifications",     <NotificationsView />);
      case "extension":          return wrap("Extension",         <ExtensionView />);
      case "settings":           return wrap("Settings",          <SettingsView />);
      case "profile":            return wrap("Profile",           <ProfileView />);
      case "help":               return wrap("Help",              <HelpView />);
      // "autonomous" is rendered persistently below — not here
      default:                   return wrap("Editor",            <Editor />);
    }
  };

  const showAIPanel = aiPanelOpen && activeView === "editor";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden text-foreground selection:bg-primary/10">
      {/* ── Top bar ── */}
      <header className="relative z-30 shrink-0 border-b border-border/70 bg-card/95 backdrop-blur-md">
        <div className="flex h-12 items-center gap-2 pl-12 pr-3 md:px-5">

          {/* Left — document title + timestamp */}
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {currentDoc?.title ||
                (documents.length === 0 ? "No document" : "Untitled")}
            </p>
            {activityText && (
              <span className="hidden md:inline shrink-0 text-[10px] text-muted-foreground/60 font-mono">
                · {activityText}
              </span>
            )}
          </div>

          {/* Center — phase breadcrumb */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <PhaseBreadcrumb activeView={activeView} setActiveView={setActiveView} />
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            {activeView === "editor" && (
              <button
                type="button"
                onClick={toggleAiPanel}
                className={`
                  inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
                  transition-all duration-150 border
                  ${
                    aiPanelOpen
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/60 bg-transparent text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5"
                  }
                `}
                aria-pressed={aiPanelOpen}
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div
        className={
          showAIPanel
            ? `grid min-h-0 flex-1 grid-cols-1 ${sidebarCollapsed ? "md:grid-cols-[68px_minmax(0,1fr)] lg:grid-cols-[68px_minmax(0,1fr)_360px]" : "md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_360px]"}`
            : `grid min-h-0 flex-1 grid-cols-1 ${sidebarCollapsed ? "md:grid-cols-[68px_minmax(0,1fr)]" : "md:grid-cols-[240px_minmax(0,1fr)]"}`
        }
      >
        <div className="hidden min-h-0 border-r border-border/70 md:block transition-all duration-300">
          <ModernSidebar onCollapsedChange={setSidebarCollapsed} />
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden bg-card">
          {/* All views except Autonomous Mode — unmount freely */}
          <div style={{ display: activeView === "autonomous" ? "none" : undefined }} className="h-full">
            {renderMainView()}
          </div>
          {/* Autonomous Mode — kept mounted once visited so state survives navigation */}
          {autonomousMounted && (
            <div style={{ display: activeView !== "autonomous" ? "none" : undefined }} className="h-full">
              <AutonomousModeView />
            </div>
          )}
        </div>

        {showAIPanel && (
          <div className="hidden min-h-0 border-l border-border/70 bg-muted/40 lg:block">
            {/* Only mount AIPanel when this column is actually visible (lg+).
                The mobile overlay below renders the same component on smaller
                screens. Never mounting both at once prevents duplicate timers,
                analysis calls, and subscriptions from the two instances. */}
            {isDesktopPanel && <AIPanel />}
          </div>
        )}
      </div>

      {/* ── Mobile AI panel overlay (xs/sm/md — below lg) ── */}
      {/* Only rendered when below the lg breakpoint so AIPanel is never
          mounted twice alongside the desktop column above. */}
      {showAIPanel && !isDesktopPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={toggleAiPanel}
          />
          {/* Slide-in panel */}
          <div className="fixed top-0 right-0 h-full w-[90vw] max-w-sm z-50 border-l border-border/70 bg-card shadow-2xl lg:hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Ask AI
              </span>
              <button
                type="button"
                onClick={toggleAiPanel}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close AI panel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AIPanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
