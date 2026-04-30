import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ActivityEventType = "ai" | "success" | "info" | "warning";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description?: string;
  timestamp: number;
  read: boolean;
}

interface ActivityStore {
  events: ActivityEvent[];
  unreadCount: number;
  push: (title: string, description?: string, type?: ActivityEventType) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set) => ({
      events: [],
      unreadCount: 0,
      push: (title, description, type = "info") => {
        const event: ActivityEvent = {
          id: Math.random().toString(36).slice(2),
          type,
          title,
          description,
          timestamp: Date.now(),
          read: false,
        };
        set((s) => ({
          events: [event, ...s.events].slice(0, 40),
          unreadCount: s.unreadCount + 1,
        }));
      },
      markAllRead: () => set((s) => ({
        events: s.events.map((e) => ({ ...e, read: true })),
        unreadCount: 0,
      })),
      clear: () => set({ events: [], unreadCount: 0 }),
    }),
    {
      name: "Speckula-activity",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ events: state.events, unreadCount: state.unreadCount }),
    }
  )
);

export const activity = {
  push: (title: string, description?: string, type: ActivityEventType = "info") =>
    useActivityStore.getState().push(title, description, type),
  ai: (title: string, description?: string) =>
    useActivityStore.getState().push(title, description, "ai"),
  success: (title: string, description?: string) =>
    useActivityStore.getState().push(title, description, "success"),
  warning: (title: string, description?: string) =>
    useActivityStore.getState().push(title, description, "warning"),
  info: (title: string, description?: string) =>
    useActivityStore.getState().push(title, description, "info"),
};
