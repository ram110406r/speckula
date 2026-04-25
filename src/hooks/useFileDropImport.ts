"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

import { importFromPDF, ImportError } from "@/lib/api/importClient";
import { insertTextAsNodes } from "@/lib/editor/insertTextAsNodes";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CSV_ROWS = 200;

const SUPPORTED_EXTS = [".txt", ".md", ".pdf", ".csv"] as const;

interface UseFileDropImportArgs {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface UseFileDropImportResult {
  isDragging: boolean;
  errorMessage: string | null;
  isImporting: boolean;
  dismissError: () => void;
}

const getExtension = (name: string): string => {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
};

const stripMarkdown = (text: string): string => {
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
};

// Minimal CSV parser: respects quoted fields with embedded commas / newlines.
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        current.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(field);
        rows.push(current);
        current = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows;
};

const csvToText = (csv: string): string => {
  const rows = parseCsv(csv).filter((r) => r.some((cell) => cell.trim().length > 0));
  if (rows.length <= 1) return rows.flat().join(" — ");
  const dataRows = rows.slice(1, MAX_CSV_ROWS + 1);
  return dataRows.map((row) => row.map((cell) => cell.trim()).filter(Boolean).join(" — ")).join("\n");
};

export function useFileDropImport({ editor, containerRef }: UseFileDropImportArgs): UseFileDropImportResult {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const dragDepth = useRef(0);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    window.setTimeout(() => {
      setErrorMessage((current) => (current === message ? null : current));
    }, 4500);
  }, []);

  const dismissError = useCallback(() => setErrorMessage(null), []);

  const importFile = useCallback(
    async (file: File) => {
      if (!editor) return;

      const ext = getExtension(file.name);
      if (!SUPPORTED_EXTS.includes(ext as (typeof SUPPORTED_EXTS)[number])) {
        showError("Unsupported file type. Drop a .txt, .md, .pdf, or .csv file.");
        return;
      }

      if (file.size > MAX_BYTES) {
        showError("File is too large. Maximum size is 10MB.");
        return;
      }

      setIsImporting(true);
      try {
        if (ext === ".pdf") {
          const result = await importFromPDF(file);
          insertTextAsNodes(editor, result.text);
        } else {
          const raw = await file.text();
          let text = raw;
          if (ext === ".md") text = stripMarkdown(raw);
          else if (ext === ".csv") text = csvToText(raw);
          insertTextAsNodes(editor, text);
        }
      } catch (error) {
        if (error instanceof ImportError) {
          showError(error.message || "Could not import that file.");
        } else if (ext === ".pdf") {
          showError("Could not extract PDF text. Try copy-pasting the content instead.");
        } else {
          showError("Could not read that file.");
        }
      } finally {
        setIsImporting(false);
      }
    },
    [editor, showError]
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const handleDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes("Files")) return;
      e.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) importFile(file);
    };

    node.addEventListener("dragenter", handleDragEnter);
    node.addEventListener("dragover", handleDragOver);
    node.addEventListener("dragleave", handleDragLeave);
    node.addEventListener("drop", handleDrop);

    return () => {
      node.removeEventListener("dragenter", handleDragEnter);
      node.removeEventListener("dragover", handleDragOver);
      node.removeEventListener("dragleave", handleDragLeave);
      node.removeEventListener("drop", handleDrop);
    };
  }, [containerRef, importFile]);

  return { isDragging, errorMessage, isImporting, dismissError };
}
