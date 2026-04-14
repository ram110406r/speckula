import { create } from 'zustand';

export type AppView = 'editor' | 'insights' | 'prds' | 'tasks' | 'decisions';

interface BuildcaseDocument {
  id: string;
  title: string;
  updatedAt: unknown;
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

interface AppState {
  aiPanelOpen: boolean;
  toggleAiPanel: () => void;
  activeContext: string;
  setActiveContext: (context: string) => void;
  currentDocId: string | null;
  setCurrentDocId: (id: string | null) => void;
  documents: BuildcaseDocument[];
  setDocuments: (docs: BuildcaseDocument[]) => void;
  isSaving: boolean;
  setIsSaving: (status: boolean) => void;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  pendingInsertion: string | null;
  setPendingInsertion: (content: string | null) => void;
  dismissedHintsByDoc: Record<string, string[]>;
  dismissHintForDoc: (docId: string, hintId: string) => void;
  clearDismissedHintsForDoc: (docId: string) => void;
  strategicContext: StrategicContext | null;
  setStrategicContext: (context: StrategicContext | null) => void;
  pendingDecisionForPRD: DecisionForPRD | null;
  setPendingDecisionForPRD: (decision: DecisionForPRD | null) => void;
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
  dismissedHintsByDoc: {},
  strategicContext: null,
  pendingDecisionForPRD: null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  setActiveContext: (context) => set({ activeContext: context }),
  setCurrentDocId: (id) => set({ currentDocId: id }),
  setDocuments: (docs) => set({ documents: docs }),
  setIsSaving: (status) => set({ isSaving: status }),
  setActiveView: (view) => set({ activeView: view }),
  setPendingInsertion: (content) => set({ pendingInsertion: content }),
  setStrategicContext: (context) => set({ strategicContext: context }),
  setPendingDecisionForPRD: (decision) => set({ pendingDecisionForPRD: decision }),
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
}));

