import { create } from 'zustand';

interface AppState {
  aiPanelOpen: boolean;
  toggleAiPanel: () => void;
  activeContext: string;
  setActiveContext: (context: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  aiPanelOpen: true,
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  activeContext: '',
  setActiveContext: (context) => set({ activeContext: context }),
}));
