import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Timestamp } from 'firebase/firestore';

export type AppView =
  // Core product views (existing)
  | 'editor' | 'insights' | 'prds' | 'tasks' | 'decisions' | 'platform' | 'slack' | 'autonomous'
  // Platform views (new)
  | 'workspace' | 'settings' | 'notifications'
  | 'extension' | 'activity' | 'profile' | 'help';

interface SpeckulaDocument {
  id: string;
  title: string;
  updatedAt: Timestamp | null;
}

interface StrategicContext {
  theme: string;
  rationale: string;
}

interface DecisionForPRD {
  title: string;
  priority: "high" | "medium" | "low";
  userStory: string;
  tradeoffs: string;
}

interface PRDForTasks {
  id: string;
  title: string;
  content: string;
}

interface TaskDependencyRecord {
  taskIndex: number;
  dependsOnIndices: number[];
  reason: string;
}

interface ExpectedOutcomeState {
  metric: string;
  target_value: number;
  timeframe: string;
}

interface ActualOutcomeState {
  metric: string;
  value: number;
  // ISO timestamp; aligns with the canonical ActualOutcome type now that
  // outcome data syncs to Firestore (no longer a JS millisecond timestamp).
  observedAt: string;
}

interface OutcomeLoopState {
  expectedOutcome: ExpectedOutcomeState | null;
  actualOutcome: ActualOutcomeState | null;
  learningInsight: string | null;
  confidenceBefore: number;
  confidenceAfter: number;
}

interface PendingInsightForDecision {
  title: string;
  description: string;
}

interface PhaseHasContent {
  insights: boolean;
  decisions: boolean;
  prds: boolean;
}

interface AppState {
  aiPanelOpen: boolean;
  toggleAiPanel: () => void;
  activeContext: string;
  setActiveContext: (context: string) => void;
  currentDocId: string | null;
  setCurrentDocId: (id: string | null) => void;
  documents: SpeckulaDocument[];
  setDocuments: (docs: SpeckulaDocument[]) => void;
  isSaving: boolean;
  setIsSaving: (status: boolean) => void;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  pendingInsertion: string | null;
  setPendingInsertion: (content: string | null) => void;
  newDocumentId: string | null;
  markDocumentAsNew: (id: string) => void;
  clearNewDocumentFlag: (id: string) => void;
  pendingImport: { text: string; title: string | null } | null;
  setPendingImport: (payload: { text: string; title: string | null } | null) => void;
  dismissedHintsByDoc: Record<string, string[]>;
  dismissHintForDoc: (docId: string, hintId: string) => void;
  clearDismissedHintsForDoc: (docId: string) => void;
  strategicContext: StrategicContext | null;
  setStrategicContext: (context: StrategicContext | null) => void;
  pendingDecisionForPRD: DecisionForPRD | null;
  setPendingDecisionForPRD: (decision: DecisionForPRD | null) => void;
  selectedPRDForTasks: PRDForTasks | null;
  setSelectedPRDForTasks: (prd: PRDForTasks | null) => void;
  taskDependencies: TaskDependencyRecord[] | null;
  setTaskDependencies: (deps: TaskDependencyRecord[] | null) => void;
  outcomeLoop: OutcomeLoopState;
  setOutcomeLoop: (state: Partial<OutcomeLoopState>) => void;
  // Cross-view handoffs
  pendingInsightForDecision: PendingInsightForDecision | null;
  setPendingInsightForDecision: (insight: PendingInsightForDecision | null) => void;
  pendingPRDId: string | null;
  setPendingPRDId: (id: string | null) => void;
  phaseHasContent: PhaseHasContent;
  setPhaseHasContent: (patch: Partial<PhaseHasContent>) => void;
  resetForNewDocument: () => void;
  resetState: () => void;
}

const initialState = {
  aiPanelOpen: true,
  activeContext: '',
  currentDocId: null,
  documents: [],
  isSaving: false,
  activeView: 'editor' as AppView,
  pendingInsertion: null,
  newDocumentId: null,
  pendingImport: null,
  dismissedHintsByDoc: {},
  strategicContext: null,
  pendingDecisionForPRD: null,
  selectedPRDForTasks: null,
  taskDependencies: null,
  outcomeLoop: {
    expectedOutcome: null,
    actualOutcome: null,
    learningInsight: null,
    confidenceBefore: 0,
    confidenceAfter: 0,
  },
  pendingInsightForDecision: null,
  pendingPRDId: null,
  phaseHasContent: { insights: false, decisions: false, prds: false },
};

const initialOutcomeLoopState: OutcomeLoopState = {
  expectedOutcome: null,
  actualOutcome: null,
  learningInsight: null,
  confidenceBefore: 0,
  confidenceAfter: 0,
};

export const useAppStore = create<AppState>()(persist((set) => ({
  ...initialState,
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  setActiveContext: (context) => set({ activeContext: context }),
  setCurrentDocId: (id) => set({ currentDocId: id }),
  setDocuments: (docs) => set({ documents: docs }),
  setIsSaving: (status) => set({ isSaving: status }),
  setActiveView: (view) => set({ activeView: view }),
  setPendingInsertion: (content) => set({ pendingInsertion: content }),
  markDocumentAsNew: (id) => set({ newDocumentId: id }),
  clearNewDocumentFlag: (id) =>
    set((state) => (state.newDocumentId === id ? { newDocumentId: null } : state)),
  setPendingImport: (payload) => set({ pendingImport: payload }),
  setStrategicContext: (context) => set({ strategicContext: context }),
  setPendingDecisionForPRD: (decision) => set({ pendingDecisionForPRD: decision }),
  setSelectedPRDForTasks: (prd) => set({ selectedPRDForTasks: prd }),
  setTaskDependencies: (deps) => set({ taskDependencies: deps }),
  setPendingInsightForDecision: (insight) => set({ pendingInsightForDecision: insight }),
  setPendingPRDId: (id) => set({ pendingPRDId: id }),
  setPhaseHasContent: (patch) => set((s) => ({ phaseHasContent: { ...s.phaseHasContent, ...patch } })),
  setOutcomeLoop: (state) =>
    set((current) => ({
      outcomeLoop: {
        ...current.outcomeLoop,
        ...state,
      },
    })),
  resetForNewDocument: () =>
    set({
      activeContext: '',
      activeView: 'editor',
      pendingInsertion: null,
      strategicContext: null,
      pendingDecisionForPRD: null,
      selectedPRDForTasks: null,
      taskDependencies: null,
      outcomeLoop: { ...initialOutcomeLoopState },
    }),
  dismissHintForDoc: (docId, hintId) =>
    set((state) => {
      const existing = state.dismissedHintsByDoc[docId] ?? [];
      if (existing.includes(hintId)) return state;

      return {
        dismissedHintsByDoc: {
          ...state.dismissedHintsByDoc,
          [docId]: [...existing, hintId],
        },
      };
    }),
  clearDismissedHintsForDoc: (docId) =>
    set((state) => {
      const next = { ...state.dismissedHintsByDoc };
      delete next[docId];
      return { dismissedHintsByDoc: next };
    }),
  resetState: () => set({ ...initialState, documents: [] }),
}), {
  name: 'Speckula-app-store-v1',
  storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : (undefined as unknown as Storage))),
  // Persist only the user-visible UI prefs and per-doc dismissed hints.
  // Ephemeral runtime state (documents list, isSaving, pending* fields,
  // strategicContext, taskDependencies, outcomeLoop) must NOT be cached
  // across reloads — those are computed live from Firestore on mount.
  partialize: (state) => ({
    aiPanelOpen: state.aiPanelOpen,
    activeView: state.activeView,
    dismissedHintsByDoc: state.dismissedHintsByDoc,
  }),
  version: 1,
}));
