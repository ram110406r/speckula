import { create } from 'zustand';

interface AppState {
  aiPanelOpen: boolean;
  toggleAiPanel: () => void;
  activeContext: string;
  setActiveContext: (context: string) => void;
  currentDocId: string | null;
  setCurrentDocId: (id: string | null) => void;
  isSaving: boolean;
  setIsSaving: (status: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  aiPanelOpen: true,
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  activeContext: '',
  setActiveContext: (context) => set({ activeContext: context }),
  currentDocId: 'default-doc', // For MVP, we use relative IDs or titles
  setCurrentDocId: (id) => set({ currentDocId: id }),
  isSaving: false,
  setIsSaving: (status) => set({ isSaving: status }),
}));
