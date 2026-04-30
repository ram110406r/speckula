"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { useExportDialogStore } from "@/store/useExportDialogStore";
import { Button } from "@/components/ui/button";

export function ExportDialog() {
  const { config, close } = useExportDialogStore();
  const [filename, setFilename] = useState("");
  const [format, setFormat] = useState("");
  const [exporting, setExporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      setFilename(config.defaultFilename);
      setFormat(config.formats[0]?.value ?? "");
      setExporting(false);
      setTimeout(() => {
        inputRef.current?.select();
      }, 50);
    }
  }, [config]);

  if (!config) return null;

  const handleExport = async () => {
    const name = filename.trim() || config.defaultFilename;
    setExporting(true);
    try {
      await config.onExport(name, format);
    } finally {
      setExporting(false);
      close();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleExport();
    if (e.key === "Escape") close();
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={handleKey}
      >
        {/* Close */}
        <button
          onClick={close}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-sm font-semibold text-foreground mb-5">Export file</h2>

        {/* Filename */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            File name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
            placeholder="filename"
          />
        </div>

        {/* Format */}
        {config.formats.length > 1 && (
          <div className="mb-6">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Format
            </label>
            <div className="flex flex-col gap-2">
              {config.formats.map((f) => (
                <label
                  key={f.value}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    format === f.value
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={f.value}
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                    className="accent-primary"
                  />
                  <span className="text-xs font-medium">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={close} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={exporting || !filename.trim()}
            className="h-8 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>
      </div>
    </div>
  );
}
