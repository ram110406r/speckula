"use client";

import React from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/store/useToastStore";

const config: Record<ToastVariant, { icon: React.ElementType; cls: string; iconCls: string }> = {
  success: { icon: CheckCircle2, cls: "border-emerald-500/30 bg-emerald-500/10",  iconCls: "text-emerald-500" },
  error:   { icon: XCircle,      cls: "border-red-500/30 bg-red-500/10",           iconCls: "text-red-500"     },
  info:    { icon: Info,         cls: "border-primary/30 bg-primary/10",           iconCls: "text-primary"     },
  warning: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/10",      iconCls: "text-amber-500"   },
};

export function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const { icon: Icon, cls, iconCls } = config[t.variant];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 w-full sm:w-80 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 fade-in duration-200 ${cls} bg-card`}
          >
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconCls}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 p-1.5 -m-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
