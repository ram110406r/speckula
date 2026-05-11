"use client";

import { useEffect } from "react";
import { useAppStore, type AppView } from "@/store/useAppStore";

const VIEW_KEYS: Record<string, AppView> = {
  "1": "autonomous",
  "2": "editor",
  "3": "market-intelligence",
  "4": "decisions",
  "5": "specifications",
  "6": "tasks",
  "7": "projects",
  "8": "integrations",
};

export function useKeyboardShortcuts(onNewDoc?: () => void) {
  const { setActiveView, toggleAiPanel } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      // Ctrl/Cmd + \ → toggle AI panel
      if (mod && e.key === "\\") {
        e.preventDefault();
        toggleAiPanel();
        return;
      }

      // Ctrl/Cmd + N → new document
      if (mod && e.key === "n") {
        e.preventDefault();
        onNewDoc?.();
        return;
      }

      // Ctrl/Cmd + 1-8 → switch views (only when not typing)
      if (mod && !isEditing && VIEW_KEYS[e.key]) {
        e.preventDefault();
        setActiveView(VIEW_KEYS[e.key]);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveView, toggleAiPanel, onNewDoc]);
}
