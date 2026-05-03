"use client";

import React from "react";
import { Globe, Link2, Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseBriefData } from "@/lib/ai/actions";

interface CaseBriefDialogProps {
  open: boolean;
  loading: boolean;
  data: CaseBriefData | null;
  error: string | null;
  onClose: () => void;
  onPublish?: () => Promise<void>;
  isPublishing?: boolean;
  publishedUrl?: string | null;
}

const verdictTone: Record<CaseBriefData["verdict"]["recommendation"], string> = {
  Build: "text-success",
  Delay: "text-warning",
  Validate: "text-primary",
};

export function CaseBriefDialog({ open, loading, data, error, onClose, onPublish, isPublishing, publishedUrl }: CaseBriefDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:bg-transparent print:p-0 print:items-start"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-[760px] rounded-xl border border-border bg-card shadow-2xl animate-brief-expand print:my-0 print:max-w-none print:w-full print:rounded-none print:border-0 print:shadow-none"
        onClick={(e) => e.stopPropagation()}
        data-print-region
      >
        {/* Toolbar (hidden on print) */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3 print:hidden">
          <span className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">
            Case brief
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => window.print()}
              disabled={!data || loading}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
            {data && onPublish && (
              publishedUrl ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-emerald-600 hover:text-emerald-700"
                  onClick={() => navigator.clipboard.writeText(publishedUrl).catch(() => {})}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" />
                  Copy Link
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={onPublish}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Globe className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isPublishing ? "Publishing…" : "Publish"}
                </Button>
              )
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Close brief">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="px-12 py-12 print:px-0 print:py-0 case-brief-body">
          {loading && (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Drafting brief…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && data && (
            <article className="case-brief-article">
              <h1 className="text-3xl font-bold leading-tight tracking-[-0.01em] text-foreground">
                {data.title}
              </h1>

              {data.context && (
                <section className="mt-8">
                  <p className="case-brief-meta">Context</p>
                  <p className="case-brief-paragraph">{data.context}</p>
                </section>
              )}

              {data.evidence.length > 0 && (
                <section className="mt-8">
                  <p className="case-brief-meta">Evidence</p>
                  <ul className="case-brief-evidence">
                    {data.evidence.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {data.insights.length > 0 && (
                <section className="mt-8">
                  <p className="case-brief-meta">Insights</p>
                  <ul className="case-brief-bullets">
                    {data.insights.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {data.decision && (
                <section className="mt-8">
                  <p className="case-brief-meta">Decision</p>
                  <p className="case-brief-paragraph">{data.decision}</p>
                </section>
              )}

              <section className="mt-8">
                <p className="case-brief-meta">Scoring</p>
                <dl className="grid grid-cols-4 gap-x-6 gap-y-2 mt-3 font-sans">
                  {(["impact", "effort", "confidence", "demand"] as const).map((dim) => (
                    <div key={dim} className="flex items-baseline justify-between border-b border-border/50 pb-2">
                      <dt className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{dim}</dt>
                      <dd className="font-mono text-sm tabular-nums">{data.scoring[dim]}/10</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Composite</span>
                  <span className="font-mono text-base font-semibold tabular-nums">{data.scoring.score}/100</span>
                </div>
                {data.scoring.reasoning && (
                  <p className="case-brief-paragraph mt-3 italic text-muted-foreground">{data.scoring.reasoning}</p>
                )}
              </section>

              {data.risks.length > 0 && (
                <section className="mt-8">
                  <p className="case-brief-meta">Risks &amp; Unknowns</p>
                  <ul className="case-brief-bullets">
                    {data.risks.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="mt-10 border-t border-border/60 pt-8">
                <p className="case-brief-meta">Verdict</p>
                <p className={`mt-3 text-xl font-semibold ${verdictTone[data.verdict.recommendation]}`}>
                  {data.verdict.recommendation}
                </p>
                {data.verdict.rationale && (
                  <p className="case-brief-paragraph mt-2">{data.verdict.rationale}</p>
                )}
              </section>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
