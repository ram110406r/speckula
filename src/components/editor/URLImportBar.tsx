"use client";

import React, { useEffect, useRef, useState } from "react";
import { Link2, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { importFromURL, ImportError } from "@/lib/api/importClient";

interface URLImportBarProps {
  visible: boolean;
  onImport: (text: string, title: string | null) => void;
  onDismiss: () => void;
}

export function URLImportBar({ visible, onImport, onDismiss }: URLImportBarProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setError(null);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setValue("");
      setLoading(false);
    }
  }, [visible]);

  if (!visible) return null;

  const submit = async () => {
    if (loading) return;
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) return;

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setError("Enter a valid URL");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setError("Enter a valid URL");
      return;
    }

    setLoading(true);
    try {
      const result = await importFromURL(parsed.toString());
      onImport(result.text, result.title);
      setValue("");
      onDismiss();
    } catch (err) {
      const message = err instanceof ImportError ? err.message : "Could not import that URL.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
    }
  };

  return (
    <div className="border-b border-border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Paste a URL to import content…"
          disabled={loading}
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        <Button size="sm" onClick={submit} disabled={loading || !value.trim()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Import
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onDismiss} aria-label="Close URL import">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {error && (
        <div className="px-3 pb-2 text-[11px] text-destructive">{error}</div>
      )}
    </div>
  );
}
