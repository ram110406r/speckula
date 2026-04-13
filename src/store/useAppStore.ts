import { create } from 'zustand';

export type AppView = 'editor' | 'insights' | 'prds' | 'tasks';

interface AppState {
  aiPanelOpen: boolean;
  toggleAiPanel: () => void;
  activeContext: string;
  setActiveContext: (context: string) => void;
  currentDocId: string | null;
  setCurrentDocId: (id: string | null) => void;
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
  currentDocId: 'default-doc',
  setCurrentDocId: (id) => set({ currentDocId: id }),
  isSaving: false,
  setIsSaving: (status) => set({ isSaving: status }),
  activeView: 'editor',
  setActiveView: (view) => set({ activeView: view }),
}));
