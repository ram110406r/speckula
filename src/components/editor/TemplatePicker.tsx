"use client";

import React from "react";
import { Users, MessageSquareWarning, Lightbulb, FileText } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TEMPLATES, BLANK, type SpeckulaTemplate } from "@/lib/templates";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  MessageSquareWarning,
  Lightbulb,
  FileText,
};

interface TemplatePickerProps {
  open: boolean;
  onSelect: (template: SpeckulaTemplate) => void;
}

export function TemplatePicker({ open, onSelect }: TemplatePickerProps) {
  const cardRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const active = document.activeElement;
    const idx = cardRefs.current.findIndex((el) => el === active);
    if (idx === -1) return;
    event.preventDefault();
    const dir = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = (idx + dir + cardRefs.current.length) % cardRefs.current.length;
    cardRefs.current[next]?.focus();
  };

  return (
    <Dialog
      open={open}
      // Controlled dialog with all dismissal sources blocked: backdrop press
      // (disablePointerDismissal) and Escape (onOpenChange swallows it).
      // The user must pick a template card or "Start blank".
      onOpenChange={() => { /* user must pick a template */ }}
      disablePointerDismissal
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape") event.preventDefault();
          handleKeyDown(event);
        }}
      >
        <DialogHeader>
          <DialogTitle>Start with a template</DialogTitle>
          <DialogDescription>
            Choose a structure to give the AI better signal, or start blank.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {TEMPLATES.map((template, index) => {
            const Icon = ICON_MAP[template.icon] ?? FileText;
            return (
              <button
                key={template.id}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                type="button"
                onClick={() => onSelect(template)}
                className="group flex flex-col items-start gap-1.5 rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex items-center gap-2 text-foreground">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold">{template.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-start pt-1">
          <button
            type="button"
            onClick={() => onSelect(BLANK)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Start blank →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
