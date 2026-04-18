"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Copy, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { addCaseComment, getCaseComments, getPublicCase, updatePublicCase, type CaseComment, type PublicCase } from "@/lib/firebase/db";
import type { CaseAuditEvent } from "@/lib/platform/publishCase";

interface CaseOutcomeData {
  expectedOutcome?: {
    metric?: string;
    target_value?: number;
    timeframe?: string;
  };
  audit?: CaseAuditEvent;
  [key: string]: unknown;
}

function parseCaseOutcome(outcome: Record<string, unknown> | undefined | null): CaseOutcomeData {
  if (!outcome || typeof outcome !== "object") return {};
  return outcome as CaseOutcomeData;
}

function formatAuditTime(value: number | undefined) {
  if (!value || Number.isNaN(value)) return "-";
  return new Date(value).toLocaleString();
}

export function CaseViewer({ caseId }: { caseId: string }) {
  const { user } = useAuth();
  const [record, setRecord] = React.useState<(PublicCase & { id: string }) | null>(null);
  const [comments, setComments] = React.useState<(CaseComment & { id: string })[]>([]);
  const [commentContent, setCommentContent] = React.useState("");
  const [replyParentId, setReplyParentId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [caseData, commentData] = await Promise.all([getPublicCase(caseId), getCaseComments(caseId)]);
      setRecord(caseData);
      setComments(commentData);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleComment = async () => {
    if (!user || !commentContent.trim()) return;
    setSaving(true);
    try {
      await addCaseComment(caseId, user.uid, commentContent.trim(), replyParentId);
      setCommentContent("");
      setReplyParentId(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async () => {
    if (!record || record.userId !== user?.uid) return;
    const currentOutcome = parseCaseOutcome(record.outcome);
    const currentAudit = currentOutcome.audit;

    await updatePublicCase(caseId, {
      visibility: record.visibility === "public" ? "private" : "public",
      outcome: {
        ...currentOutcome,
        audit: {
          publishedAt: currentAudit?.publishedAt ?? Date.now(),
          publishedBy: currentAudit?.publishedBy ?? record.userId,
          lastEditedAt: Date.now(),
        },
      },
    });
    await load();
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><p className="label-system text-[12px] text-muted-foreground">Loading case...</p></div>;
  }

  if (!record) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="label-system text-[12px] text-muted-foreground">Case not found</p>
          <Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Return home
          </Link>
        </div>
      </div>
    );
  }

  const outcomeData = parseCaseOutcome(record.outcome);
  const audit = outcomeData.audit;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/60 bg-white/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href={`/u/${record.userId}`} className="inline-flex items-center gap-2 label-system text-[12px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
          </Link>
          <Button variant="outline" size="sm" className="label-system text-[12px]" onClick={() => navigator.clipboard.writeText(window.location.href)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Link
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <section className="rounded-3xl border border-border/60 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Product Case</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">{record.title}</h1>
              <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{record.content}</p>
            </div>
            <div className="min-w-[180px] rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <p className="label-system text-[10px] uppercase tracking-[0.24em] text-primary">Score</p>
              <p className="mt-2 text-4xl font-semibold">{record.score}</p>
              <p className="mt-1 text-xs text-muted-foreground">Opportunity score</p>
              {record.userId === user?.uid && (
                <Button className="mt-4 w-full" variant="outline" onClick={toggleVisibility}>
                  Make {record.visibility === "public" ? "Private" : "Public"}
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard label="Visibility" value={record.visibility} />
          <InfoCard label="Outcome" value={record.outcome && Object.keys(record.outcome).length > 0 ? "Recorded" : "Pending"} />
          <InfoCard label="Discussion" value={comments.length.toString()} />
        </section>

        <section className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="label-system text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Publish Audit Log</p>
              <h2 className="mt-2 text-lg font-semibold">Recruiter verification</h2>
            </div>
            <span className="label-system text-[11px] text-muted-foreground">Traceable events</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoCard label="Published At" value={formatAuditTime(audit?.publishedAt)} />
            <InfoCard label="Published By" value={audit?.publishedBy || "-"} />
            <InfoCard label="Last Edited" value={formatAuditTime(audit?.lastEditedAt)} />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl border border-border/60 bg-white p-8 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-xl font-semibold">Thinking + Outcome</h2>
            </div>
            <pre className="whitespace-pre-wrap rounded-2xl border border-border/60 bg-background p-5 text-xs leading-relaxed text-foreground">{JSON.stringify(record.outcome, null, 2)}</pre>
          </div>

          <div className="rounded-3xl border border-border/60 bg-white p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="text-xl font-semibold">Discussion</h2>
            </div>
            <div className="space-y-3">
              {replyParentId && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary flex items-center justify-between gap-3">
                  <span>Replying in a thread.</span>
                  <button className="underline" onClick={() => setReplyParentId(null)}>Clear</button>
                </div>
              )}
              <Textarea value={commentContent} onChange={(event) => setCommentContent(event.target.value)} placeholder="Leave a comment or challenge the decision" className="min-h-[110px]" />
              <Button onClick={handleComment} disabled={!user || saving} className="w-full">{saving ? "Posting..." : "Post Comment"}</Button>
            </div>
            <div className="space-y-3 pt-2">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No discussion yet.</p>
              ) : (
                <div className="space-y-3">
                  {comments
                    .filter((comment) => !comment.parentId)
                    .map((comment) => (
                      <CommentThread
                        key={comment.id}
                        comment={comment}
                        replies={comments.filter((entry) => entry.parentId === comment.id)}
                        onReply={() => setReplyParentId(comment.id)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm text-center">
      <p className="label-system text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function CommentThread({
  comment,
  replies,
  onReply,
}: {
  comment: CaseComment & { id: string };
  replies: (CaseComment & { id: string })[];
  onReply: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/60 bg-background p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">{comment.userId}</p>
          <button className="text-[11px] text-primary hover:underline" onClick={onReply}>Reply</button>
        </div>
        <p className="mt-2 text-sm leading-relaxed">{comment.content}</p>
      </div>
      {replies.length > 0 && (
        <div className="ml-6 space-y-3 border-l border-border/60 pl-4">
          {replies.map((reply) => (
            <div key={reply.id} className="rounded-2xl border border-border/60 bg-white p-4">
              <p className="text-xs text-muted-foreground">{reply.userId}</p>
              <p className="mt-2 text-sm leading-relaxed">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}