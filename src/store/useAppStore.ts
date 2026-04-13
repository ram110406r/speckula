import { create } from 'zustand';

export type AppView = 'editor' | 'insights' | 'prds' | 'tasks';

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
}

export const useAppStore = create<AppState>((set) => ({
  aiPanelOpen: true,
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  activeContext: '',
  setActiveContext: (context) => set({ activeContext: context }),
  currentDocId: null,
  setCurrentDocId: (id) => set({ currentDocId: id }),
  documents: [],
  setDocuments: (docs) => set({ documents: docs }),
  isSaving: false,
  setIsSaving: (status) => set({ isSaving: status }),
  activeView: 'editor',
  setActiveView: (view) => set({ activeView: view }),
}));

