"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getPublicCase, type PublicCase } from "@/lib/firebase/db";

const verdictTone: Record<"Build" | "Delay" | "Validate", string> = {
  Build: "text-emerald-600",
  Delay: "text-amber-600",
  Validate: "text-primary",
};

const priorityCls: Record<"high" | "medium" | "low", string> = {
  high: "bg-primary/10 text-primary",
  medium: "bg-muted text-muted-foreground",
  low: "bg-transparent text-muted-foreground/70",
};

export function PublicCasePage({ caseId }: { caseId: string }) {
  const [publicCase, setPublicCase] = React.useState<PublicCase | null | undefined>(undefined);

  React.useEffect(() => {
    getPublicCase(caseId).then(setPublicCase);
  }, [caseId]);

  if (publicCase === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!publicCase) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-2xl font-bold">Case not found</h1>
        <p className="text-sm text-muted-foreground">
          This case may have been unpublished or the link is invalid.
        </p>
        <Link href="/" className="text-sm text-primary hover:underline">
          Go to Buildcase
        </Link>
      </div>
    );
  }

  const { brief, score, priority } = publicCase;

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-[760px]">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Buildcase
          </Link>
          <div className="flex items-center gap-2">
            {score !== undefined && (
              <span className="font-mono text-xs text-muted-foreground">Score: {score}</span>
            )}
            {priority && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${priorityCls[priority]}`}>
                {priority}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border/70 px-5 py-3">
            <span className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">
              Case brief
            </span>
          </div>

          <div className="px-10 py-10">
            <article>
              <h1 className="text-3xl font-bold leading-tight tracking-[-0.01em] text-foreground">
                {brief.title}
              </h1>

              {brief.context && (
                <section className="mt-8">
                  <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">Context</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">{brief.context}</p>
                </section>
              )}

              {brief.evidence.length > 0 && (
                <section className="mt-8">
                  <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">Evidence</p>
                  <ul className="mt-2 space-y-1 text-sm leading-relaxed text-foreground/80">
                    {brief.evidence.map((item, idx) => (
                      <li key={idx} className="pl-4 relative before:absolute before:left-0 before:content-['·']">{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {brief.insights.length > 0 && (
                <section className="mt-8">
                  <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">Insights</p>
                  <ul className="mt-2 space-y-1 text-sm leading-relaxed text-foreground/80">
                    {brief.insights.map((item, idx) => (
                      <li key={idx} className="pl-4 relative before:absolute before:left-0 before:content-['·']">{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {brief.decision && (
                <section className="mt-8">
                  <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">Decision</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">{brief.decision}</p>
                </section>
              )}

              <section className="mt-8">
                <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">Scoring</p>
                <dl className="mt-3 grid grid-cols-4 gap-x-6 gap-y-2 font-sans">
                  {(["impact", "effort", "confidence", "demand"] as const).map((dim) => (
                    <div key={dim} className="flex items-baseline justify-between border-b border-border/50 pb-2">
                      <dt className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{dim}</dt>
                      <dd className="font-mono text-sm tabular-nums">{brief.scoring[dim]}/10</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Composite</span>
                  <span className="font-mono text-base font-semibold tabular-nums">{brief.scoring.score}/100</span>
                </div>
                {brief.scoring.reasoning && (
                  <p className="mt-3 text-xs italic text-muted-foreground leading-relaxed">{brief.scoring.reasoning}</p>
                )}
              </section>

              {brief.risks.length > 0 && (
                <section className="mt-8">
                  <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">Risks &amp; Unknowns</p>
                  <ul className="mt-2 space-y-1 text-sm leading-relaxed text-foreground/80">
                    {brief.risks.map((item, idx) => (
                      <li key={idx} className="pl-4 relative before:absolute before:left-0 before:content-['·']">{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="mt-10 border-t border-border/60 pt-8">
                <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-muted-foreground">Verdict</p>
                <p className={`mt-3 text-xl font-semibold ${verdictTone[brief.verdict.recommendation]}`}>
                  {brief.verdict.recommendation}
                </p>
                {brief.verdict.rationale && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">{brief.verdict.rationale}</p>
                )}
              </section>
            </article>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Published with{" "}
          <Link href="/" className="hover:underline">
            Buildcase
          </Link>
        </p>
      </div>
    </div>
  );
}
