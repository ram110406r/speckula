"use client";

import { TipTapEditor } from "./TipTapEditor";

export function Editor() {
  return (
    <div className="flex h-full flex-col w-full">
      <div className="flex items-center border-b border-border h-14 px-6 shrink-0">
        <span className="text-sm font-medium text-muted-foreground">Untitled Document</span>
      </div>
      <div className="flex-1 overflow-auto p-8 lg:p-12">
        <TipTapEditor />
      </div>
    </div>
  );
}
