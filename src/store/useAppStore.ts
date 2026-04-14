import { create } from 'zustand';

export type AppView = 'editor' | 'insights' | 'prds' | 'tasks' | 'decisions';

interface BuildcaseDocument {
  id: string;
  title: string;
  updatedAt: any;
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
  resetState: () => void;
}

const initialState = {
  aiPanelOpen: true,
  activeContext: '',
  currentDocId: null,
  documents: [],
  isSaving: false,
  activeView: 'editor' as AppView,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  setActiveContext: (context) => set({ activeContext: context }),
  setCurrentDocId: (id) => set({ currentDocId: id }),
  setDocuments: (docs) => set({ documents: docs }),
  setIsSaving: (status) => set({ isSaving: status }),
  setActiveView: (view) => set({ activeView: view }),
  resetState: () => set({ ...initialState, documents: [] }),
}));

