"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import {
  Wand2, Lightbulb, CheckSquare, ArrowRight,
  Loader2, Menu, X, Clock, Zap,
  Upload, FileText, Check, Shield, Lock as LockIcon,
  Quote, Calendar,
  Database, MessageSquare, CodeXml, Boxes, Sparkles, GitBranch,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { COLOR, SERIF, LIQUID_COLORS, gridBg } from "./tokens";
import { AnimateIn, useShouldRenderHeavyMotion } from "./AnimateIn";
import {
  SectionEyebrow, WorkflowStage, WorkflowArrow, FeatureCard, PricingCard, FooterChipGroup,
} from "./primitives";
import { PasteAreaMock, ThemeChipsMock, DocPreviewMock, TaskListMock } from "./mocks";

// Lazy-loaded: Three.js (~600KB) is code-split out of the initial bundle and
// only fetched when LiquidEther actually renders — i.e. on pointer-fine,
// motion-OK devices. Touch / reduced-motion visitors never download it.
const LiquidEther = dynamic(() => import("@/components/layout/LiquidEther"), { ssr: false });

/* ── Main component ───────────────────────────────────────────────────────── */
export function LandingPage() {
  const { loginWithGoogle, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const renderHeavyMotion = useShouldRenderHeavyMotion();

  const navRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const methodologyRef = useRef<HTMLElement>(null);
  const pricingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Scroll fires ~60×/s while scrolling — without the value-change guard,
    // we'd queue a React render on every tick (most of them no-ops, but still
    // a reconcile pass). The closure captures the last applied value.
    let last = window.scrollY > 20;
    setScrolled(last);
    const onScroll = () => {
      const next = window.scrollY > 20;
      if (next !== last) {
        last = next;
        setScrolled(next);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on Escape or a click/tap outside the nav.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileMenuOpen(false); };
    const onPointer = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [mobileMenuOpen]);

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    // Respect reduced-motion: jump instantly instead of smooth-scrolling.
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  const navLinks: Array<[string, React.RefObject<HTMLElement | null>]> = [
    ["Features", featuresRef],
    ["How It Works", methodologyRef],
    ["Pricing", pricingRef],
  ];

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden text-[color:var(--ink)]"
      style={{ ["--ink" as string]: COLOR.ink, backgroundColor: COLOR.paper }}
    >
      {/* Skip link — first focusable element; visible only on keyboard focus. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
        style={{ backgroundColor: COLOR.ink, color: COLOR.paper }}
      >
        Skip to main content
      </a>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav
        ref={navRef}
        className={`sticky top-0 z-50 w-full transition-shadow duration-300 ${scrolled ? "shadow-[0_1px_0_0_rgba(0,0,0,0.9)]" : ""}`}
        style={{ backgroundColor: COLOR.paper }}
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">

          <div className="flex items-center gap-2.5 shrink-0">
            <Image src="/logo.png" alt="Speckula Logo" width={48} height={48} className="object-contain scale-[1.7]" />
            <span className="font-semibold text-lg tracking-tight hidden sm:inline" style={{ color: COLOR.ink }}>Speckula</span>
          </div>

          <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
            {navLinks.map(([label, ref]) => (
              <button
                key={label}
                type="button"
                onClick={() => scrollTo(ref)}
                className="text-sm font-medium transition-colors"
                style={{ color: COLOR.mute }}
                onMouseEnter={(e) => (e.currentTarget.style.color = COLOR.ink)}
                onMouseLeave={(e) => (e.currentTarget.style.color = COLOR.mute)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button
              className="h-9 px-5 text-sm rounded-full font-medium border bg-transparent transition-all"
              style={{ borderColor: COLOR.ink, color: COLOR.ink }}
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Signing in…</> : "Sign In"}
            </Button>
          </div>

          <div className="flex md:hidden items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="h-10 px-4 text-xs sm:text-sm rounded-full border bg-transparent font-medium"
              style={{ borderColor: COLOR.ink, color: COLOR.ink }}
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sign In"}
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
              className="h-10 w-10 flex items-center justify-center rounded-full border transition-colors shrink-0"
              style={{ borderColor: COLOR.ink, color: COLOR.ink }}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            id="mobile-menu"
            className="md:hidden px-4 py-4 flex flex-col gap-2 animate-fade-in"
            style={{ borderTop: `1px solid ${COLOR.ink}`, backgroundColor: COLOR.paper }}
          >
            {navLinks.map(([label, ref]) => (
              <button
                key={label}
                type="button"
                onClick={() => scrollTo(ref)}
                className="w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-colors"
                style={{ color: COLOR.mute }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main id="main-content">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden px-4 sm:px-6 pt-16 sm:pt-24 lg:pt-32 pb-20 sm:pb-28 lg:pb-32"
          style={{ backgroundColor: COLOR.inkSoft, color: "#ffffff", borderBottom: `1px solid ${COLOR.ink}` }}
        >
          {/* Fluid backdrop — WebGL fluid sim on pointer-fine, motion-OK devices;
              cheap static gradient otherwise (touch / prefers-reduced-motion).
              The static fallback matches the violet palette so the hero never
              feels "missing" a backdrop. */}
          <div className="absolute inset-0 pointer-events-none">
            {renderHeavyMotion ? (
              <LiquidEther
                colors={LIQUID_COLORS}
                mouseForce={18}
                cursorSize={120}
                resolution={0.4}
                pixelRatio={1}
                antialias={false}
                autoDemo
                autoSpeed={0.4}
                autoIntensity={1.8}
                takeoverDuration={0.25}
                autoResumeDelay={3000}
                autoRampDuration={0.6}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 60% at 30% 30%, rgba(126,67,245,0.45), transparent 60%), " +
                    "radial-gradient(ellipse 60% 50% at 75% 65%, rgba(233,213,255,0.30), transparent 65%), " +
                    `linear-gradient(180deg, ${COLOR.inkSoft} 0%, #2a1c47 100%)`,
                }}
              />
            )}
          </div>
          {/* Focused glow under headline. Was mix-blend-screen for highlight lift,
              but blend modes force a separate composite pass — too expensive when
              scrolling over the fluid sim. Plain opacity is visually close enough. */}
          <div
            className="absolute inset-x-0 top-0 h-[700px] pointer-events-none opacity-60"
            style={{ background: "radial-gradient(ellipse 70% 60% at 50% 20%, rgba(126,67,245,0.28), transparent 70%)" }}
          />

          <div className="relative z-10 w-full max-w-6xl mx-auto">

            {/* Centered hero stack */}
            <div className="max-w-4xl mx-auto text-center space-y-7 sm:space-y-9">

              <AnimateIn>
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)" }}
                >
                  <Zap className="h-3.5 w-3.5" style={{ color: COLOR.butter }} />
                  <span>AI-powered product decisions</span>
                </div>
              </AnimateIn>

              <AnimateIn delay={80}>
                <h1
                  className="text-balance font-light leading-[1.02] tracking-[-0.01em] text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem]"
                  style={{
                    ...SERIF,
                    textShadow: "0 0 40px rgba(126,67,245,0.45)",
                  }}
                >
                  Turn market signals into{" "}
                  <em
                    className="italic"
                    style={{ color: COLOR.mint, textShadow: "0 0 30px rgba(233,213,255,0.45)" }}
                  >
                    winning strategy
                  </em>
                </h1>
              </AnimateIn>

              <AnimateIn delay={160}>
                <p
                  className="text-balance text-lg sm:text-xl text-white/75 leading-[1.6] max-w-2xl mx-auto font-normal"
                  style={{ textShadow: "0 0 22px rgba(126,67,245,0.25)" }}
                >
                  Speckula transforms raw customer data into actionable insights and polished PRDs. Ship better products in half the time.
                </p>
              </AnimateIn>

              <AnimateIn delay={240} className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
                <Button
                  className="group h-12 px-7 sm:px-8 rounded-full font-medium text-base transition-all active:scale-[0.98] w-full sm:w-auto"
                  style={{ backgroundColor: "#ffffff", color: COLOR.ink }}
                  onClick={loginWithGoogle}
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                  ) : (
                    <>Get Started Free <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
                  )}
                </Button>
                <Button
                  className="h-12 px-6 sm:px-7 rounded-full font-medium text-base bg-transparent border transition-all w-full sm:w-auto"
                  style={{ borderColor: "rgba(255,255,255,0.3)", color: "#ffffff" }}
                  onClick={() => scrollTo(methodologyRef)}
                >
                  See How It Works
                </Button>
              </AnimateIn>

              <AnimateIn delay={320}>
                <p className="text-sm text-white/50">No credit card required. Free plan forever, or Pro from $23/month.</p>
              </AnimateIn>

              {/* TODO(speckula): COMPLIANCE CLAIMS — verify before public launch.
                  "SOC 2 Type II" and "GDPR Compliant" appear here, in the Trust
                  section, the final CTA, and the footer. If the audit/compliance
                  work is not yet complete, these are legally risky and must be
                  softened (e.g. "SOC 2 in progress") or removed. Do not ship
                  unverified. */}
              <AnimateIn delay={400}>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Shield className="h-3.5 w-3.5" />
                    <span>SOC 2 Type II</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <LockIcon className="h-3.5 w-3.5" />
                    <span>GDPR Compliant</span>
                  </div>
                </div>
              </AnimateIn>
            </div>

            {/* Workflow demo card — light card on dark hero */}
            <AnimateIn variant="scale" delay={520} className="mt-14 sm:mt-20 lg:mt-24 max-w-5xl mx-auto">
              <div
                className="relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]"
                style={{ backgroundColor: COLOR.paper, border: `1px solid ${COLOR.ink}` }}
              >
                <div className="flex flex-col lg:flex-row items-stretch gap-3">
                  <WorkflowStage num="1" title="Capture Customer Data" subtitle="Interviews, reviews, feedback, support tickets" tint={COLOR.lilac} />
                  <WorkflowArrow />
                  <WorkflowStage num="2" title="AI Extracts Insights" subtitle="Pain points, opportunities, patterns detected" tint={COLOR.butter} />
                  <WorkflowArrow />
                  <WorkflowStage num="3" title="Generate PRD" subtitle="Complete specification with acceptance criteria" tint={COLOR.peach} />
                  <WorkflowArrow />
                  <WorkflowStage num="✓" title="Ship & Measure" subtitle="Tasks, roadmap, outcomes tracked" tint={COLOR.mint} highlighted />
                </div>

                <div
                  className="mt-6 sm:mt-8 pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center"
                  style={{ borderTop: `1px solid ${COLOR.ink}` }}
                >
                  <p className="text-xs sm:text-sm" style={{ color: COLOR.mute }}>Raw transcript to shippable PRD</p>
                  <span className="hidden sm:inline" style={{ color: COLOR.mute }}>·</span>
                  <p className="text-base sm:text-lg font-medium" style={{ color: COLOR.ink }}>8 minutes</p>
                </div>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* ── Social Proof — testimonials, cream band ───────────────────────── */}
        {/* TODO(speckula): Replace TESTIMONIALS placeholder content with real
            customer quotes before public launch. Fictional companies kept here
            to preserve layout fidelity during design review. */}
        <section
          className="px-4 sm:px-6 py-16 sm:py-24"
          style={{ backgroundColor: COLOR.cream, borderBottom: `1px solid ${COLOR.ink}` }}
        >
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="mb-10 sm:mb-14 text-center space-y-3">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] font-medium" style={{ color: COLOR.mute }}>
                What product teams are saying
              </p>
              <p className="text-sm sm:text-base" style={{ color: COLOR.mute }}>
                Built by ex-PMs from <span style={{ color: COLOR.ink, fontWeight: 500 }}>Localhost</span>, <span style={{ color: COLOR.ink, fontWeight: 500 }}>Recursify</span> and <span style={{ color: COLOR.ink, fontWeight: 500 }}>Edutou</span>.
              </p>
            </AnimateIn>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border" style={{ borderColor: COLOR.ink, backgroundColor: COLOR.paper }}>
              {[
                {
                  quote: "Cut our PRD time from six hours to thirty-five minutes. The insight extraction was the part I didn't know I needed.",
                  name:  "Sujan Saitej.",
                  title: "Head of Product",
                  company: "Localhost",
                },
                {
                  quote: "We used to lose half a sprint chasing themes across fifty transcripts. Speckula collapsed that into a coffee break.",
                  name:  "Naseer.",
                  title: "Senior PM",
                  company: "Recursify",
                },
                {
                  quote: "The acceptance criteria it generates are eighty per cent of what we'd ship. Editing beats writing from scratch every time.",
                  name:  "Rishi.",
                  title: "Product Lead",
                  company: "Edutou",
                },
              ].map(({ quote, name, title, company }, i) => (
                <AnimateIn key={name} delay={i * 100}>
                  <figure
                    className="p-7 sm:p-8 lg:p-10 h-full flex flex-col gap-5"
                    style={{ borderLeft: i === 0 ? "none" : `1px solid ${COLOR.ink}` }}
                  >
                    <Quote className="h-5 w-5 shrink-0" style={{ color: COLOR.accent }} />
                    <blockquote
                      className="text-base sm:text-lg leading-[1.55] flex-1"
                      style={{ color: COLOR.ink, ...SERIF, fontStyle: "italic", fontWeight: 400 }}
                    >
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                    <figcaption className="flex items-center gap-3 pt-2" style={{ borderTop: `1px solid ${COLOR.lilac}` }}>
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                        style={{ backgroundColor: COLOR.lilac, color: COLOR.ink, border: `1px solid ${COLOR.ink}` }}
                      >
                        {name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: COLOR.ink }}>{name}</p>
                        <p className="text-xs" style={{ color: COLOR.mute }}>{title} · {company}</p>
                      </div>
                    </figcaption>
                  </figure>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features — lavender band ──────────────────────────────────────── */}
        <section
          ref={featuresRef}
          id="features"
          className="px-4 sm:px-6 py-20 sm:py-28 lg:py-36"
          style={{ backgroundColor: COLOR.lilac, borderBottom: `1px solid ${COLOR.ink}` }}
        >
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="text-center mb-14 sm:mb-20 space-y-5">
              <SectionEyebrow>Core capabilities</SectionEyebrow>
              <h2
                className="text-balance font-light leading-[1.05] tracking-[-0.01em] text-4xl sm:text-5xl lg:text-6xl max-w-3xl mx-auto"
                style={{ ...SERIF, color: COLOR.ink }}
              >
                Everything your team needs to turn <em className="italic">insights into shipped features</em>.
              </h2>
            </AnimateIn>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border" style={{ borderColor: COLOR.ink }}>
              <FeatureCard
                icon={<Lightbulb className="h-5 w-5" />}
                title="Insights Engine"
                description="Drop in 200 transcripts. Get the top 5 themes ranked by impact in 90 seconds — not 90 hours."
                position="first"
                accentTint={COLOR.lilac}
                visual={<ThemeChipsMock />}
              />
              <FeatureCard
                icon={<Wand2 className="h-5 w-5" />}
                title="AI PRD Generator"
                description="One click produces a 12-section PRD with market context, user stories, and acceptance criteria — editable beats blank."
                position="middle"
                accentTint={COLOR.mint}
                visual={<DocPreviewMock />}
              />
              <FeatureCard
                icon={<CheckSquare className="h-5 w-5" />}
                title="Task Breakdown"
                description="Strategy becomes a prioritized task list in your tracker. Stop translating decisions into tickets by hand."
                position="last"
                accentTint={COLOR.butter}
                visual={<TaskListMock />}
              />
            </div>
          </div>
        </section>

        {/* ── How It Works — butter band ────────────────────────────────────── */}
        <section
          ref={methodologyRef}
          id="methodology"
          className="relative overflow-hidden px-4 sm:px-6 py-20 sm:py-28 lg:py-36"
          style={{ backgroundColor: COLOR.butter, borderBottom: `1px solid ${COLOR.ink}` }}
        >
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={gridBg("black")} />
          <div className="relative w-full max-w-5xl mx-auto">
            {/* h2 pattern intentionally broken here — leading with the number is the section's only memorable claim */}
            <AnimateIn className="text-center mb-14 sm:mb-20 space-y-4">
              <SectionEyebrow>How It Works</SectionEyebrow>
              <p className="text-sm sm:text-base uppercase tracking-[0.18em] font-medium" style={{ color: COLOR.mute }}>
                Raw transcript to shippable PRD in
              </p>
              <div
                className="text-7xl sm:text-8xl lg:text-[9rem] font-light leading-none tracking-[-0.02em]"
                style={{ ...SERIF, color: COLOR.ink }}
              >
                8 <em className="italic">minutes</em>.
              </div>
              <p className="text-base sm:text-lg leading-[1.6] max-w-xl mx-auto pt-2" style={{ color: COLOR.mute }}>
                Three steps. No setup. No prompt engineering.
              </p>
            </AnimateIn>

            <div className="border" style={{ borderColor: COLOR.ink, backgroundColor: COLOR.paper }}>
              {[
                { num: "01", time: "5 min", icon: <Upload className="h-5 w-5" />,    title: "Ingest Data",      description: "Paste customer interviews, reviews, or survey responses. Speckula structures everything automatically.", visual: <PasteAreaMock /> },
                { num: "02", time: "2 min", icon: <Lightbulb className="h-5 w-5" />, title: "Extract Insights", description: "AI analysis surfaces pain points and patterns. Grouped by theme, ready for strategy.",                      visual: <ThemeChipsMock /> },
                { num: "03", time: "1 min", icon: <FileText className="h-5 w-5" />,  title: "Generate PRD",     description: "One click produces a polished, production-ready PRD with all context and acceptance criteria.",            visual: <DocPreviewMock /> },
              ].map(({ num, time, icon, title, description, visual }, i) => (
                <AnimateIn key={num} delay={i * 100}>
                  <div
                    className="grid grid-cols-[auto,1fr] lg:grid-cols-[120px,1fr,240px] gap-5 sm:gap-8 items-start p-6 sm:p-8 lg:p-10"
                    style={{ borderTop: i === 0 ? "none" : `1px solid ${COLOR.ink}` }}
                  >
                    <div
                      className="text-5xl sm:text-6xl lg:text-7xl font-light leading-none tracking-[-0.02em]"
                      style={{ ...SERIF, color: COLOR.ink }}
                    >
                      {num}
                    </div>
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span style={{ color: COLOR.mute }}>{icon}</span>
                        <h3 className="text-xl sm:text-2xl font-medium tracking-tight" style={{ color: COLOR.ink }}>{title}</h3>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: COLOR.butter, color: COLOR.ink, border: `1px solid ${COLOR.ink}` }}
                        >
                          {time}
                        </span>
                      </div>
                      <p className="text-base sm:text-lg leading-[1.65]" style={{ color: COLOR.mute }}>{description}</p>
                    </div>
                    <div
                      className="hidden lg:block rounded-lg p-3 self-center w-full"
                      style={{ backgroundColor: COLOR.cream, border: `1px solid ${COLOR.ink}` }}
                    >
                      {visual}
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>

            {/* Total-time callout — closes the loop on the 5+2+1 arithmetic */}
            <AnimateIn delay={350}>
              <div
                className="mt-5 sm:mt-6 rounded-xl px-5 sm:px-7 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center"
                style={{ backgroundColor: COLOR.ink, color: COLOR.paper, border: `1px solid ${COLOR.ink}` }}
              >
                <Clock className="h-4 w-4 shrink-0" style={{ color: COLOR.butter }} />
                <p className="text-sm sm:text-base font-medium">
                  Total: <span style={{ color: COLOR.butter }}>8 minutes</span> from raw transcript to a PRD you'd actually ship.
                </p>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* ── Trust & Integrations — mint band ──────────────────────────────── */}
        <section
          id="trust"
          className="px-4 sm:px-6 py-20 sm:py-28 lg:py-36"
          style={{ backgroundColor: COLOR.mint, borderBottom: `1px solid ${COLOR.ink}` }}
        >
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="text-center mb-14 sm:mb-20 space-y-5">
              <SectionEyebrow>Trust & Integrations</SectionEyebrow>
              <h2
                className="text-balance font-light leading-[1.05] tracking-[-0.01em] text-4xl sm:text-5xl lg:text-6xl max-w-3xl mx-auto"
                style={{ ...SERIF, color: COLOR.ink }}
              >
                Your customer data, <em className="italic">never used to train AI</em>.
              </h2>
              <p className="text-base sm:text-lg leading-[1.6] max-w-2xl mx-auto" style={{ color: COLOR.mute }}>
                Enterprise-grade security from day one. Connect the tools your team already uses.
              </p>
            </AnimateIn>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border" style={{ borderColor: COLOR.ink, backgroundColor: COLOR.paper }}>
              {[
                {
                  icon: <Shield className="h-5 w-5" />,
                  title: "SOC 2 Type II",
                  description: "Annual third-party audit covering security, availability, and confidentiality controls. Report available under NDA.",
                  tag: "Audited",
                },
                {
                  icon: <LockIcon className="h-5 w-5" />,
                  title: "GDPR Compliant",
                  description: "Data residency in EU regions on request. Customer-controlled deletion, DPA on file, sub-processor list maintained.",
                  tag: "Compliant",
                },
                {
                  icon: <Database className="h-5 w-5" />,
                  title: "Never Trained On",
                  description: "Your transcripts, PRDs, and decisions are encrypted at rest and never used to train models — ours or any third party's.",
                  tag: "Contractual",
                },
              ].map(({ icon, title, description, tag }, i) => (
                <AnimateIn key={title} delay={i * 100}>
                  <div
                    className="p-7 sm:p-8 lg:p-10 h-full flex flex-col gap-4"
                    style={{ borderLeft: i === 0 ? "none" : `1px solid ${COLOR.ink}` }}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="h-11 w-11 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: COLOR.lilac, color: COLOR.ink, border: `1px solid ${COLOR.ink}` }}
                      >
                        {icon}
                      </div>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: COLOR.ink, color: COLOR.paper }}
                      >
                        {tag}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-medium tracking-tight" style={{ color: COLOR.ink }}>{title}</h3>
                    <p className="text-base leading-[1.65]" style={{ color: COLOR.mute }}>{description}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>

            {/* Integrations strip — text chips so we don't ship third-party brand assets */}
            <AnimateIn delay={350} className="mt-14 sm:mt-20 text-center space-y-6">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] font-medium" style={{ color: COLOR.mute }}>
                Connects with the tools you already use
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {[
                  { label: "Slack",  icon: <MessageSquare className="h-3.5 w-3.5" /> },
                  { label: "Notion", icon: <FileText      className="h-3.5 w-3.5" /> },
                  { label: "Linear", icon: <GitBranch     className="h-3.5 w-3.5" /> },
                  { label: "GitHub", icon: <CodeXml       className="h-3.5 w-3.5" /> },
                  { label: "Jira",   icon: <Boxes         className="h-3.5 w-3.5" /> },
                  { label: "Figma",  icon: <Sparkles      className="h-3.5 w-3.5" /> },
                ].map(({ label, icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium"
                    style={{ backgroundColor: COLOR.paper, color: COLOR.ink, border: `1px solid ${COLOR.ink}` }}
                  >
                    {icon}
                    {label}
                  </span>
                ))}
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* ── Pricing — cream band ──────────────────────────────────────────── */}
        <section
          ref={pricingRef}
          id="pricing"
          className="px-4 sm:px-6 py-20 sm:py-28 lg:py-36"
          style={{ backgroundColor: COLOR.cream, borderBottom: `1px solid ${COLOR.ink}` }}
        >
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="text-center mb-10 sm:mb-14 space-y-5">
              <SectionEyebrow>Pricing</SectionEyebrow>
              <h2
                className="text-balance font-light leading-[1.05] tracking-[-0.01em] text-4xl sm:text-5xl lg:text-6xl"
                style={{ ...SERIF, color: COLOR.ink }}
              >
                Simple, <em className="italic">transparent</em> pricing.
              </h2>
              <p className="text-base sm:text-lg leading-[1.6]" style={{ color: COLOR.mute }}>
                Start free. Scale as you grow. Cancel anytime.
              </p>
            </AnimateIn>

            {/* Billing toggle — annual default with explicit savings copy */}
            <AnimateIn delay={120} className="flex justify-center mb-12 sm:mb-16">
              <div
                className="inline-flex items-center gap-1 p-1 rounded-full"
                style={{ backgroundColor: COLOR.paper, border: `1px solid ${COLOR.ink}` }}
                role="radiogroup"
                aria-label="Billing interval"
              >
                {(["monthly", "annual"] as const).map((interval) => {
                  const active = billing === interval;
                  return (
                    <button
                      key={interval}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={interval === "monthly" ? "Monthly billing" : "Annual billing, save 20%"}
                      onClick={() => setBilling(interval)}
                      className="px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: active ? COLOR.ink   : "transparent",
                        color:           active ? COLOR.paper : COLOR.ink,
                      }}
                    >
                      {interval === "monthly" ? "Monthly" : (
                        <span className="inline-flex items-center gap-2">
                          Annual
                          <span
                            className="text-[10px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: active ? COLOR.butter : COLOR.lilac,
                              color: COLOR.ink,
                            }}
                          >
                            -20%
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </AnimateIn>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border items-stretch" style={{ borderColor: COLOR.ink }}>
              <PricingCard
                name="Starter"
                price="Free"
                description="For solo founders validating a problem"
                features={[
                  "1 seat",
                  "10 analyses / month",
                  "Up to 50 transcripts / analysis",
                  "Insight extraction (Sonnet)",
                  "AI PRD generator",
                  "30-day history retention",
                  "Community support",
                ]}
                cta="Start free"
                onCta={loginWithGoogle}
                loading={loading}
                bg={COLOR.paper}
                position="first"
              />
              <PricingCard
                name="Pro"
                price={billing === "annual" ? "$23" : "$29"}
                period={billing === "annual" ? "/mo · billed annually" : "/month"}
                description="For product teams shipping every sprint"
                features={[
                  "Up to 10 seats",
                  "Unlimited analyses",
                  "Unlimited transcripts",
                  "Advanced AI models (Opus)",
                  "Task generation → Linear / Jira / GitHub",
                  "Slack & Notion integrations",
                  "Unlimited history retention",
                  "Priority support (12h SLA)",
                ]}
                cta="Start 7-day free trial"
                onCta={loginWithGoogle}
                loading={loading}
                highlighted
                badge="Most Popular"
                bg={COLOR.mint}
                position="middle"
              />
              <PricingCard
                name="Enterprise"
                price="Custom"
                description="For organisations with security review"
                features={[
                  "Unlimited seats",
                  "Custom analysis workflows",
                  "SSO / SAML & SCIM provisioning",
                  "SOC 2 report under NDA",
                  "EU data residency on request",
                  "Dedicated success manager",
                  "99.9% uptime SLA",
                ]}
                cta="Book a call"
                onCta={() => { window.location.href = "mailto:support@speckula.ai?subject=Speckula%20Enterprise%20enquiry"; }}
                bg={COLOR.paper}
                position="last"
              />
            </div>

            {/* Trial assurance — repeat near the conversion moment */}
            <AnimateIn delay={350} className="mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
              <span className="inline-flex items-center gap-2 text-sm" style={{ color: COLOR.mute }}>
                <Check className="h-3.5 w-3.5" style={{ color: COLOR.ink }} />
                No credit card required to start
              </span>
              <span className="inline-flex items-center gap-2 text-sm" style={{ color: COLOR.mute }}>
                <Check className="h-3.5 w-3.5" style={{ color: COLOR.ink }} />
                7-day free trial on Pro · cancel anytime
              </span>
              <span className="inline-flex items-center gap-2 text-sm" style={{ color: COLOR.mute }}>
                <Check className="h-3.5 w-3.5" style={{ color: COLOR.ink }} />
                Free plan stays free
              </span>
            </AnimateIn>
          </div>
        </section>

        {/* ── Final CTA — dark grey echo of hero ────────────────────────────── */}
        <section
          className="relative overflow-hidden px-4 sm:px-6 py-20 sm:py-28 lg:py-36 text-center"
          style={{ backgroundColor: COLOR.inkSoft, color: "#ffffff", borderBottom: `1px solid ${COLOR.ink}` }}
        >
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={gridBg("white")} />
          <div
            className="absolute inset-0 pointer-events-none opacity-80"
            style={{ background: "radial-gradient(ellipse 55% 50% at 50% 40%, rgba(126,67,245,0.18), transparent 65%)" }}
          />
          <AnimateIn>
            <div className="relative z-10 w-full max-w-2xl mx-auto space-y-7 sm:space-y-9">
              <h2
                className="text-balance font-light leading-[1.05] tracking-[-0.01em] text-4xl sm:text-5xl lg:text-6xl"
                style={SERIF}
              >
                Ready to ship <em className="italic" style={{ color: COLOR.mint }}>better products</em> faster?
              </h2>
              <p className="text-balance text-base sm:text-lg text-white/70 leading-[1.6]">
                Join founders who've cut their product cycle in half.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-1">
                <Button
                  className="group h-12 px-7 sm:px-8 rounded-full font-medium text-base transition-all active:scale-[0.98] w-full sm:w-auto"
                  style={{ backgroundColor: "#ffffff", color: COLOR.ink }}
                  onClick={loginWithGoogle}
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                  ) : (
                    <>Generate your first PRD <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
                  )}
                </Button>
                <Button
                  className="h-12 px-6 sm:px-7 rounded-full font-medium text-base bg-transparent border transition-all w-full sm:w-auto"
                  style={{ borderColor: "rgba(255,255,255,0.3)", color: "#ffffff" }}
                  onClick={() => { window.location.href = "mailto:support@speckula.ai?subject=Speckula%20demo%20request"; }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Book a 15-min demo
                </Button>
              </div>
              <p className="text-sm text-white/50">No credit card required. 7-day free trial on Pro.</p>

              {/* Repeat trust badges at the conversion moment */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Shield className="h-3.5 w-3.5" />
                  <span>SOC 2 Type II</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <LockIcon className="h-3.5 w-3.5" />
                  <span>GDPR Compliant</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Database className="h-3.5 w-3.5" />
                  <span>Never trained on your data</span>
                </div>
              </div>
            </div>
          </AnimateIn>
        </section>

        {/* ── Footer — deep purple, plus-grid markers, giant wordmark ──────── */}
        <footer
          className="relative overflow-hidden"
          style={{ backgroundColor: COLOR.darkPurple, color: "rgba(255,255,255,0.7)" }}
        >
          <div className="px-4 sm:px-6 lg:px-12 pt-10 sm:pt-14">
            <div className="w-full max-w-7xl mx-auto">

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 py-10 sm:py-14">

                {/* Left: brand mark + tagline */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-medium">
                    <span className="text-white/30 mr-1">/</span>SPECKULA
                  </div>
                  <p
                    className="text-balance text-xl sm:text-2xl text-white/90 leading-[1.35] max-w-sm font-light"
                    style={SERIF}
                  >
                    The decision engine for product teams.
                  </p>
                </div>

                {/* Right: column chip groups */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <FooterChipGroup
                    label="Product"
                    chips={[
                      { label: "Features", onClick: () => scrollTo(featuresRef) },
                      { label: "How It Works", onClick: () => scrollTo(methodologyRef) },
                      { label: "Pricing", onClick: () => scrollTo(pricingRef) },
                    ]}
                  />
                  <FooterChipGroup
                    label="Company"
                    chips={[
                      { label: "Contact", href: "mailto:support@speckula.ai" },
                    ]}
                  />
                  <FooterChipGroup
                    label="Legal"
                    chips={[
                      { label: "Privacy", href: "/privacy" },
                      { label: "Terms", href: "/terms" },
                      { label: "Security", href: "#trust" },
                    ]}
                  />
                </div>
              </div>

              {/* Bottom row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6 sm:py-8 text-[11px] uppercase tracking-[0.15em] text-white/55">
                <div className="flex items-center gap-2.5">
                  <Image
                    src="/logo.png"
                    alt="Speckula"
                    width={20}
                    height={20}
                    className="object-contain brightness-0 invert opacity-80"
                  />
                  <span>© 2026 Speckula. All rights reserved.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2.5 py-1 rounded inline-flex items-center gap-1.5"
                    style={{ border: "1px solid rgba(255,255,255,0.2)" }}
                  >
                    <Shield className="h-3 w-3" />
                    <span>SOC 2 Type II</span>
                  </span>
                  <span
                    className="px-2.5 py-1 rounded inline-flex items-center gap-1.5"
                    style={{ border: "1px solid rgba(255,255,255,0.2)" }}
                  >
                    <LockIcon className="h-3 w-3" />
                    <span>GDPR Compliant</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Giant Speckula wordmark — serif italic, vertical gradient fill, fits any width */}
          <div className="mt-2 sm:mt-4 px-3 sm:px-6 pb-2 sm:pb-4">
            <svg
              aria-hidden="true"
              viewBox="0 0 1200 360"
              preserveAspectRatio="xMidYMid meet"
              className="block w-full h-auto select-none"
            >
              <defs>
                {/* Vertical fade from highlight violet at the top to deep brand violet at the descender */}
                <linearGradient id="speckula-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="rgba(248,242,255,0.98)" />
                  <stop offset="45%" stopColor="rgba(216,180,254,0.85)" />
                  <stop offset="85%" stopColor="rgba(126,67,245,0.55)" />
                  <stop offset="100%" stopColor="rgba(76,29,149,0.30)" />
                </linearGradient>
                {/* Soft glow that bleeds the letterforms into the dark surface */}
                <filter id="speckula-glow" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <text
                x="600"
                y="270"
                textAnchor="middle"
                textLength="1170"
                lengthAdjust="spacingAndGlyphs"
                fontSize="320"
                fontStyle="italic"
                fontWeight="400"
                fontFamily='var(--font-display), "Instrument Serif", Georgia, "Times New Roman", serif'
                fill="url(#speckula-fill)"
                filter="url(#speckula-glow)"
                style={{ fontKerning: "normal" }}
              >
                Speckula
              </text>
            </svg>
          </div>
        </footer>
      </main>
    </div>
  );
}

