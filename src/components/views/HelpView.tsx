"use client";

import React, { useState } from "react";
import {
  HelpCircle, Search, Book, Video, MessageSquare, ExternalLink,
  ChevronDown, ChevronRight, Lightbulb, Compass, LayoutDashboard,
  CheckSquare, Bot, Puzzle, Zap, ArrowRight
} from "lucide-react";

const FAQS = [
  {
    q: "How does Speckula's AI work?",
    a: "Speckula uses large language models (powered by Groq) to analyse your product research, extract signals, help structure decisions, and generate product specs. Your data is processed securely and never used to train models.",
  },
  {
    q: "What is a Signal?",
    a: "A Signal is a piece of evidence that informs a product decision — a user interview quote, a competitor feature, a metric shift, or a customer complaint. Signals are the raw input to your product brain.",
  },
  {
    q: "How do I link a Signal to a Decision?",
    a: "From the Signals view, click on any signal and use the 'Use in Decision' button. Alternatively, when creating a Decision, you can reference existing signals from the evidence panel.",
  },
  {
    q: "Can I export my specs and decisions?",
    a: "Yes. From any spec or decision view, use the export button (top right) to download as Markdown or PDF. You can also push to Notion via the Integrations page.",
  },
  {
    q: "How does the Chrome extension sync?",
    a: "The extension sends analysed page content to your workspace via your extension token. Insights appear in your Signals view within seconds of analysis completing.",
  },
  {
    q: "What does Autonomous Mode do?",
    a: "Autonomous Mode runs a 14-state AI agent that can independently research topics, generate insights, make draft decisions, and write specs — all without you manually triggering each step.",
  },
  {
    q: "How do I invite team members?",
    a: "Go to Settings → Team and use the invite form. Team members will receive an email with a join link. You can set their role (Viewer, Contributor, Admin) at any time.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit (TLS) and at rest (AES-256). We use Firebase for authentication and Firestore for storage. We never sell your data.",
  },
];

const GUIDES = [
  { icon: Lightbulb,      title: "Capturing your first signal",      time: "3 min",  tag: "Getting started" },
  { icon: Compass,        title: "Making evidence-backed decisions",  time: "5 min",  tag: "Core workflow"   },
  { icon: LayoutDashboard, title: "Writing specs with AI assistance", time: "7 min",  tag: "Core workflow"   },
  { icon: CheckSquare,    title: "Managing tasks and sprints",        time: "4 min",  tag: "Productivity"    },
  { icon: Bot,            title: "Using Autonomous Mode",            time: "6 min",  tag: "Advanced"        },
  { icon: Puzzle,         title: "Setting up the Chrome extension",  time: "3 min",  tag: "Extension"       },
];

const SHORTCUTS = [
  { keys: ["⌘", "K"],        label: "New document"          },
  { keys: ["⌘", "⇧", "I"],  label: "Go to Signals"         },
  { keys: ["⌘", "⇧", "D"],  label: "Go to Decisions"       },
  { keys: ["⌘", "⇧", "P"],  label: "Go to Specs"           },
  { keys: ["⌘", "/"],        label: "Open AI panel"         },
  { keys: ["⌘", "\\"],       label: "Toggle sidebar"        },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-start gap-3 w-full text-left py-4 hover:text-primary transition-colors group"
      >
        <ChevronDown className={`h-4 w-4 text-muted-foreground mt-0.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{q}</span>
      </button>
      {open && (
        <p className="text-[11px] text-muted-foreground leading-relaxed pb-4 pl-7 pr-4">{a}</p>
      )}
    </div>
  );
}

export function HelpView() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<"guides" | "faq" | "shortcuts">("guides");

  const filteredFAQs = FAQS.filter(
    (f) => !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto bg-background custom-scrollbar">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── Hero ── */}
        <div className="text-center mb-8">
          <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-4">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">How can we help?</h1>
          <p className="text-sm text-muted-foreground mt-1">Guides, FAQs and shortcuts for Speckula</p>
          <div className="relative mt-4 max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search help articles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-border/60 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>

        {/* ── Quick links ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { icon: Book,          label: "Documentation",      sub: "Full product reference",    href: "#" },
            { icon: Video,         label: "Video tutorials",    sub: "Watch walkthrough videos",  href: "#" },
            { icon: MessageSquare, label: "Contact support",    sub: "Get help from our team",    href: "#" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card hover:border-border hover:bg-muted/20 transition-all group"
            >
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <link.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{link.label}</p>
                <p className="text-[10px] text-muted-foreground">{link.sub}</p>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </a>
          ))}
        </div>

        {/* ── Section tabs ── */}
        <div className="flex items-center gap-1 mb-4">
          {(["guides", "faq", "shortcuts"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                activeSection === s
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {s === "faq" ? "FAQ" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Guides ── */}
        {activeSection === "guides" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GUIDES.filter((g) => !search || g.title.toLowerCase().includes(search.toLowerCase())).map((guide) => (
              <button
                key={guide.title}
                className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card hover:border-border hover:bg-muted/20 transition-all group text-left"
              >
                <div className="p-2 rounded-lg bg-muted shrink-0">
                  <guide.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{guide.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{guide.time} read</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-[10px] text-primary">{guide.tag}</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* ── FAQ ── */}
        {activeSection === "faq" && (
          <div className="rounded-xl border border-border/60 bg-card px-5">
            {filteredFAQs.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No results for "{search}"</p>
              </div>
            ) : (
              filteredFAQs.map((item) => <FAQItem key={item.q} {...item} />)
            )}
          </div>
        )}

        {/* ── Keyboard shortcuts ── */}
        {activeSection === "shortcuts" && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {SHORTCUTS.map((s) => (
              <div key={s.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-foreground">{s.label}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <kbd
                      key={i}
                      className="inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded border border-border/60 bg-muted text-[10px] font-mono text-muted-foreground"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Status + version ── */}
        <div className="mt-8 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            All systems operational
          </div>
          <span>Speckula v0.1.0</span>
        </div>

      </div>
    </div>
  );
}
