import { create } from 'zustand';

export interface ActivityEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: number;
  read: boolean;
}

interface ActivityStore {
  events: ActivityEvent[];
  unreadCount: number;
  push: (title: string, description?: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useActivityStore = create<ActivityStore>((set) => ({
  events: [],
  unreadCount: 0,
  push: (title, description) => {
    const event: ActivityEvent = {
      id: Math.random().toString(36).slice(2),
      title,
      description,
      timestamp: Date.now(),
      read: false,
    };
    set((s) => ({
      events: [event, ...s.events].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    }));
  },
  markAllRead: () => set((s) => ({
    events: s.events.map((e) => ({ ...e, read: true })),
    unreadCount: 0,
  })),
  clear: () => set({ events: [], unreadCount: 0 }),
}));

export const activity = {
  push: (title: string, description?: string) =>
    useActivityStore.getState().push(title, description),
};
