"use client";

import React from "react";
import { CloudUpload } from "lucide-react";

interface EditorDropOverlayProps {
  visible: boolean;
}

export function EditorDropOverlay({ visible }: EditorDropOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm transition-opacity duration-150"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <CloudUpload className="h-8 w-8 text-primary" />
        <span className="text-sm font-medium text-primary">Drop your file to import</span>
        <span className="text-xs text-muted-foreground">Supports .txt · .md · .pdf · .csv</span>
      </div>
    </div>
  );
}
