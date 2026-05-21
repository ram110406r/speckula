"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import {
  Wand2, Lightbulb, CheckSquare, ArrowRight,
  Loader2, Menu, X, Clock, Zap, Eye, Lock,
  Upload, FileText, Check, Shield, Lock as LockIcon,
  ChevronRight, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";
import LiquidEther from "@/components/layout/LiquidEther";

/* ── Design tokens (violet/purple scale + ink + paper) ───────────────────── */
const COLOR = {
  // Ink + neutrals
  ink:     "#14101F",      // near-black, slight violet cast
  inkSoft: "#1F1430",      // hero / final-CTA surface
  mute:    "#5B4E73",      // muted purple-grey body text
  paper:   "#FFFFFF",      // pure white

  // Violet scale — light → deep (legacy names kept for stable refs)
  cream:   "#FAF7FF",      // warm-white with violet tint
  lilac:   "#F3E8FF",      // purple-100, pale lavender
  mint:    "#E9D5FF",      // purple-200, light violet
  butter:  "#D8B4FE",      // purple-300, medium violet
  peach:   "#C084FC",      // purple-400, soft purple

  // Brand accent
  accent:  "#7E43F5",      // Speckula vivid violet

  // Deep purple (footer)
  darkPurple: "#1A0B2E",   // deep eggplant for footer surface
} as const;

// Violet palette for the LiquidEther fluid backdrop. Module-scoped so the
// reference is stable across renders (LiquidEther's effect deps include `colors`).
const LIQUID_COLORS = ["#4C1D95", "#7E43F5", "#E9D5FF"];

const SERIF: React.CSSProperties = {
  fontFamily: 'var(--font-display), "Instrument Serif", Georgia, "Times New Roman", serif',
};

/* ── Background grid pattern (subtle, used on dark + accent sections) ───── */
const gridBg = (color: "black" | "white") => {
  const fill = color === "black" ? "%23000000" : "%23ffffff";
  return {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${fill}'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  };
};

/* ── Scroll-triggered animation hook ─────────────────────────────────────── */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

type AnimateVariant = "fade-up" | "fade" | "scale";

function AnimateIn({
  children, delay = 0, className = "", variant = "fade-up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  variant?: AnimateVariant;
}) {
  const { ref, inView } = useInView();

  const hiddenClass =
    variant === "fade" ? "opacity-0"
    : variant === "scale" ? "opacity-0 scale-[0.985]"
    : "opacity-0 translate-y-4";

  const shownClass =
    variant === "fade" ? "opacity-100"
    : variant === "scale" ? "opacity-100 scale-100"
    : "opacity-100 translate-y-0";

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${inView ? shownClass : hiddenClass} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export function LandingPage() {
  const { loginWithGoogle, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const featuresRef = useRef<HTMLElement>(null);
  const methodologyRef = useRef<HTMLElement>(null);
  const pricingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${scrolled ? "shadow-[0_1px_0_0_rgba(0,0,0,0.9)]" : ""}`}
        style={{ backgroundColor: scrolled ? "rgba(255,255,255,0.92)" : COLOR.paper, backdropFilter: scrolled ? "blur(10px)" : undefined }}
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
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
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

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden px-4 sm:px-6 pt-16 sm:pt-24 lg:pt-32 pb-20 sm:pb-28 lg:pb-32"
          style={{ backgroundColor: COLOR.inkSoft, color: "#ffffff", borderBottom: `1px solid ${COLOR.ink}` }}
        >
          {/* LiquidEther fluid backdrop (Three.js, mouse-reactive, idle auto-driver) */}
          <div className="absolute inset-0 pointer-events-none">
            <LiquidEther
              colors={LIQUID_COLORS}
              mouseForce={18}
              cursorSize={120}
              resolution={0.5}
              autoDemo
              autoSpeed={0.4}
              autoIntensity={1.8}
              takeoverDuration={0.25}
              autoResumeDelay={3000}
              autoRampDuration={0.6}
            />
          </div>
          {/* Subtle grid overlay on top of fluid sim */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={gridBg("white")} />
          {/* Focused glow under headline (mix-blend-screen lifts highlights instead of fighting the sim) */}
          <div
            className="absolute inset-x-0 top-0 h-[700px] pointer-events-none opacity-50 mix-blend-screen"
            style={{ background: "radial-gradient(ellipse 70% 60% at 50% 20%, rgba(126,67,245,0.22), transparent 70%)" }}
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
                  style={SERIF}
                >
                  Turn market signals into <em className="italic" style={{ color: COLOR.mint }}>winning strategy</em>
                </h1>
              </AnimateIn>

              <AnimateIn delay={160}>
                <p className="text-balance text-lg sm:text-xl text-white/70 leading-[1.6] max-w-2xl mx-auto font-normal">
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
                <p className="text-sm text-white/50">No credit card required. 7-day free trial, then $0-49/month.</p>
              </AnimateIn>

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
                  <p className="text-xs sm:text-sm" style={{ color: COLOR.mute }}>Average time saved per cycle</p>
                  <span className="hidden sm:inline" style={{ color: COLOR.mute }}>·</span>
                  <p className="text-base sm:text-lg font-medium" style={{ color: COLOR.ink }}>2.5 hours</p>
                </div>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* ── Social Proof — cream band ─────────────────────────────────────── */}
        <section
          className="px-4 sm:px-6 py-14 sm:py-20"
          style={{ backgroundColor: COLOR.cream, borderBottom: `1px solid ${COLOR.ink}` }}
        >
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="mb-10 sm:mb-12 text-center">
              <p className="text-xs sm:text-sm uppercase tracking-[0.15em] font-medium" style={{ color: COLOR.mute }}>
                Trusted by product teams shipping faster
              </p>
            </AnimateIn>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-10 sm:gap-8 items-end">
              {[
                { metric: "4,000+", label: "Decisions Analyzed", icon: <CheckSquare className="h-4 w-4" /> },
                { metric: "2.5h",   label: "Avg Time to PRD",    icon: <Clock className="h-4 w-4" /> },
                { metric: "89%",    label: "On-Time Shipping",   icon: <Zap className="h-4 w-4" /> },
              ].map(({ metric, label, icon }, i) => (
                <AnimateIn key={metric} delay={i * 100}>
                  <div className="text-center space-y-2">
                    <div
                      className="text-6xl sm:text-7xl lg:text-8xl font-light leading-none tracking-[-0.02em]"
                      style={{ ...SERIF, color: COLOR.ink }}
                    >
                      {metric}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: COLOR.mute }}>
                      <span style={{ color: COLOR.ink }}>{icon}</span>
                      <span>{label}</span>
                    </div>
                  </div>
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
                description="Automatically surface pain points from customer data. Grouped by theme, prioritized by impact."
                position="first"
              />
              <FeatureCard
                icon={<Wand2 className="h-5 w-5" />}
                title="AI PRD Generator"
                description="One click generates polished PRDs with market context, user stories, and acceptance criteria."
                position="middle"
              />
              <FeatureCard
                icon={<CheckSquare className="h-5 w-5" />}
                title="Task Breakdown"
                description="Automatically convert strategy into prioritized tasks. Share with your team and start shipping."
                position="last"
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
            <AnimateIn className="text-center mb-14 sm:mb-20 space-y-5">
              <SectionEyebrow>The 3-step method</SectionEyebrow>
              <h2
                className="text-balance font-light leading-[1.05] tracking-[-0.01em] text-4xl sm:text-5xl lg:text-6xl"
                style={{ ...SERIF, color: COLOR.ink }}
              >
                From raw data to <em className="italic">shipped feature</em> in three steps.
              </h2>
            </AnimateIn>

            <div className="border" style={{ borderColor: COLOR.ink, backgroundColor: COLOR.paper }}>
              {[
                { num: "01", time: "5 min", icon: <Upload className="h-5 w-5" />, title: "Ingest Data", description: "Paste customer interviews, reviews, or survey responses. Speckula structures everything automatically." },
                { num: "02", time: "2 min", icon: <Lightbulb className="h-5 w-5" />, title: "Extract Insights", description: "AI analysis surfaces pain points and patterns. Grouped by theme, ready for strategy." },
                { num: "03", time: "1 min", icon: <FileText className="h-5 w-5" />, title: "Generate PRD", description: "One click generates a polished, production-ready PRD with all context and acceptance criteria." },
              ].map(({ num, time, icon, title, description }, i, arr) => (
                <AnimateIn key={num} delay={i * 100}>
                  <div
                    className="grid grid-cols-[auto,1fr] sm:grid-cols-[120px,1fr] gap-5 sm:gap-8 items-start p-6 sm:p-8 lg:p-10"
                    style={{ borderTop: i === 0 ? "none" : `1px solid ${COLOR.ink}` }}
                  >
                    <div
                      className="text-5xl sm:text-6xl lg:text-7xl font-light leading-none tracking-[-0.02em]"
                      style={{ ...SERIF, color: COLOR.ink }}
                    >
                      {num}
                    </div>
                    <div className="space-y-2">
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
                  </div>
                  {/* connector spacer suppressed since we render border via grid item */}
                  {void arr}
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Philosophy — mint band ────────────────────────────────────────── */}
        <section
          id="philosophy"
          className="px-4 sm:px-6 py-20 sm:py-28 lg:py-36"
          style={{ backgroundColor: COLOR.mint, borderBottom: `1px solid ${COLOR.ink}` }}
        >
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="text-center mb-14 sm:mb-20 space-y-5">
              <SectionEyebrow>The principles</SectionEyebrow>
              <h2
                className="text-balance font-light leading-[1.05] tracking-[-0.01em] text-4xl sm:text-5xl lg:text-6xl max-w-3xl mx-auto"
                style={{ ...SERIF, color: COLOR.ink }}
              >
                Built for teams who <em className="italic">move fast</em>.
              </h2>
              <p className="text-base sm:text-lg leading-[1.6] max-w-2xl mx-auto" style={{ color: COLOR.mute }}>
                Speckula gets out of your way. Clear, focused, precise.
              </p>
            </AnimateIn>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border" style={{ borderColor: COLOR.ink, backgroundColor: COLOR.paper }}>
              {[
                { num: "01", icon: <Eye className="h-5 w-5" />,  title: "Crystal Clear",            description: "No feature bloat. Every tool serves one purpose: better decisions faster." },
                { num: "02", icon: <Zap className="h-5 w-5" />,  title: "AI That Respects Control", description: "Automation handles the grunt work. You stay in the driver's seat." },
                { num: "03", icon: <Lock className="h-5 w-5" />, title: "Privacy First",            description: "End-to-end encrypted. Never trained on your data. Your team's secrets stay secret." },
              ].map(({ num, icon, title, description }, i) => (
                <AnimateIn key={title} delay={i * 100}>
                  <div
                    className="p-7 sm:p-8 lg:p-10 h-full flex flex-col gap-4"
                    style={{
                      borderLeft: i === 0 ? "none" : `1px solid ${COLOR.ink}`,
                    }}
                  >
                    <div className="flex items-end justify-between">
                      <span
                        className="text-6xl sm:text-7xl font-light leading-none tracking-[-0.02em] select-none"
                        style={{ ...SERIF, color: COLOR.ink, opacity: 0.18 }}
                      >
                        {num}
                      </span>
                      <span style={{ color: COLOR.ink }}>{icon}</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-medium tracking-tight mt-2" style={{ color: COLOR.ink }}>{title}</h3>
                    <p className="text-base leading-[1.65]" style={{ color: COLOR.mute }}>{description}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
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
            <AnimateIn className="text-center mb-14 sm:mb-20 space-y-5">
              <SectionEyebrow>Pricing</SectionEyebrow>
              <h2
                className="text-balance font-light leading-[1.05] tracking-[-0.01em] text-4xl sm:text-5xl lg:text-6xl"
                style={{ ...SERIF, color: COLOR.ink }}
              >
                Simple, <em className="italic">transparent</em> pricing.
              </h2>
              <p className="text-base sm:text-lg leading-[1.6]" style={{ color: COLOR.mute }}>
                Start free. Scale as you grow.
              </p>
            </AnimateIn>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border items-stretch" style={{ borderColor: COLOR.ink }}>
              <PricingCard
                name="Starter"
                price="Free"
                description="For solo founders getting started"
                features={["10 analyses/month", "Basic insight extraction", "AI PRD generator", "Email support"]}
                cta="Get Started"
                onCta={loginWithGoogle}
                loading={loading}
                bg={COLOR.paper}
                position="first"
              />
              <PricingCard
                name="Pro"
                price="$29"
                period="/month"
                description="For growing product teams"
                features={["Unlimited analyses", "Advanced AI models", "Task generation", "Slack integration", "Priority support"]}
                cta="Start Free Trial"
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
                description="For large organizations"
                features={["Custom workflows", "Dedicated account manager", "SSO & advanced security", "SLA guarantee"]}
                cta="Contact Sales"
                onCta={() => { window.location.href = "mailto:support@speckula.ai"; }}
                bg={COLOR.paper}
                position="last"
              />
            </div>
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
              <div className="pt-1">
                <Button
                  className="group h-12 px-7 sm:px-8 rounded-full font-medium text-base transition-all active:scale-[0.98] inline-flex"
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
              </div>
              <p className="text-sm text-white/50">No credit card required. 7-day free trial.</p>
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

              <PlusRow />

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
                      { label: "About", href: "#" },
                      { label: "Contact", href: "mailto:support@speckula.ai" },
                    ]}
                  />
                  <FooterChipGroup
                    label="Legal"
                    chips={[
                      { label: "Privacy", href: "/privacy" },
                      { label: "Terms", href: "/terms" },
                      { label: "Security", href: "#" },
                    ]}
                  />
                </div>
              </div>

              <PlusRow />

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

              <PlusRow />
            </div>
          </div>

          {/* Giant striped SPECKULA wordmark — SVG forces perfect-fit at any width */}
          <div className="mt-4 sm:mt-6 px-3 sm:px-6">
            <svg
              aria-hidden="true"
              viewBox="0 0 1200 260"
              preserveAspectRatio="xMidYMid meet"
              className="block w-full h-auto select-none"
            >
              <defs>
                <pattern
                  id="speckula-stripes"
                  x="0"
                  y="0"
                  width="100"
                  height="13"
                  patternUnits="userSpaceOnUse"
                >
                  <rect x="0" y="0" width="100" height="3.2" fill="rgba(243,232,255,0.92)" />
                </pattern>
              </defs>
              <text
                x="600"
                y="218"
                textAnchor="middle"
                textLength="1170"
                lengthAdjust="spacingAndGlyphs"
                fontSize="260"
                fontWeight="800"
                fontFamily='var(--font-sans), "Sora", system-ui, sans-serif'
                fill="url(#speckula-stripes)"
                stroke="rgba(243,232,255,0.32)"
                strokeWidth="0.6"
                style={{ fontKerning: "none" }}
              >
                SPECKULA
              </text>
            </svg>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="inline-block text-xs sm:text-sm font-medium uppercase tracking-[0.15em] px-3 py-1 rounded-full"
      style={{ color: COLOR.ink, backgroundColor: COLOR.paper, border: `1px solid ${COLOR.ink}` }}
    >
      {children}
    </p>
  );
}

function WorkflowStage({
  num, title, subtitle, tint, highlighted = false,
}: {
  num: string;
  title: string;
  subtitle: string;
  tint: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl p-4 sm:p-5 transition-all"
      style={{
        backgroundColor: highlighted ? tint : "#ffffff",
        border: `1px solid ${COLOR.ink}`,
      }}
    >
      <div className="flex flex-col gap-3">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-medium text-sm"
          style={{
            backgroundColor: highlighted ? COLOR.ink : tint,
            color: highlighted ? "#ffffff" : COLOR.ink,
            border: `1px solid ${COLOR.ink}`,
          }}
        >
          {num}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-sm leading-snug" style={{ color: COLOR.ink }}>{title}</p>
          <p className="text-xs leading-snug" style={{ color: COLOR.mute }}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function WorkflowArrow() {
  return (
    <div className="flex items-center justify-center shrink-0 lg:px-1" style={{ color: COLOR.mute }}>
      <ChevronDown className="h-5 w-5 lg:hidden" />
      <ChevronRight className="h-5 w-5 hidden lg:block" />
    </div>
  );
}

function FeatureCard({
  icon, title, description, position,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  position: "first" | "middle" | "last";
}) {
  return (
    <div
      className="p-7 sm:p-8 lg:p-10 h-full flex flex-col gap-5"
      style={{
        backgroundColor: COLOR.paper,
        borderLeft: position === "first" ? "none" : `1px solid ${COLOR.ink}`,
      }}
    >
      <div
        className="h-11 w-11 rounded-full flex items-center justify-center"
        style={{ backgroundColor: COLOR.lilac, color: COLOR.ink, border: `1px solid ${COLOR.ink}` }}
      >
        {icon}
      </div>
      <div className="flex-1 space-y-2.5">
        <h3 className="text-xl sm:text-2xl font-medium tracking-tight" style={{ color: COLOR.ink }}>{title}</h3>
        <p className="text-base leading-[1.65]" style={{ color: COLOR.mute }}>{description}</p>
      </div>
    </div>
  );
}

function PricingCard({
  name, price, period, description, features, cta, onCta, loading, highlighted, badge, bg, position,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  onCta: () => void;
  loading?: boolean;
  highlighted?: boolean;
  badge?: string;
  bg: string;
  position: "first" | "middle" | "last";
}) {
  return (
    <div
      className="relative p-7 sm:p-8 lg:p-10 flex flex-col gap-6 h-full"
      style={{
        backgroundColor: bg,
        borderLeft: position === "first" ? "none" : `1px solid ${COLOR.ink}`,
      }}
    >
      {badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider whitespace-nowrap"
          style={{ backgroundColor: COLOR.ink, color: "#ffffff", border: `1px solid ${COLOR.ink}` }}
        >
          {badge}
        </div>
      )}
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.15em] mb-3" style={{ color: COLOR.mute }}>{name}</div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-none"
            style={{ ...SERIF, color: COLOR.ink }}
          >
            {price}
          </span>
          {period && <span className="text-sm" style={{ color: COLOR.mute }}>{period}</span>}
        </div>
        <p className="text-sm mt-3 leading-[1.6]" style={{ color: COLOR.mute }}>{description}</p>
      </div>
      <ul className="space-y-3 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: COLOR.ink }} />
            <span className="text-sm leading-[1.5]" style={{ color: COLOR.ink }}>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className="h-11 w-full rounded-full font-medium transition-all active:scale-[0.98] text-base"
        style={
          highlighted
            ? { backgroundColor: COLOR.ink, color: "#ffffff" }
            : { backgroundColor: "transparent", color: COLOR.ink, border: `1px solid ${COLOR.ink}` }
        }
        onClick={onCta}
        disabled={loading}
      >
        {loading && highlighted
          ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Signing in…</>
          : cta}
      </Button>
    </div>
  );
}

function PlusRow() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-between text-white/35 text-sm select-none py-0.5 font-mono"
      style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
    >
      <span className="-translate-y-1/2 leading-none">+</span>
      <span className="hidden sm:inline -translate-y-1/2 leading-none">+</span>
      <span className="hidden md:inline -translate-y-1/2 leading-none">+</span>
      <span className="hidden md:inline -translate-y-1/2 leading-none">+</span>
      <span className="-translate-y-1/2 leading-none">+</span>
      <span className="hidden md:inline -translate-y-1/2 leading-none">+</span>
      <span className="hidden md:inline -translate-y-1/2 leading-none">+</span>
      <span className="hidden sm:inline -translate-y-1/2 leading-none">+</span>
      <span className="-translate-y-1/2 leading-none">+</span>
    </div>
  );
}

function FooterChipGroup({ label, chips }: {
  label: string;
  chips: Array<{ label: string; href?: string; onClick?: () => void }>;
}) {
  const chipClass =
    "text-[10.5px] font-medium uppercase tracking-[0.1em] px-2.5 py-1 rounded text-white/90 hover:text-white transition-colors";
  const chipStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.2)" };

  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 font-medium">
        <span className="text-white/30 mr-1">/</span>{label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map(({ label, href, onClick }) =>
          onClick ? (
            <button key={label} type="button" onClick={onClick} className={chipClass} style={chipStyle}>
              {label}
            </button>
          ) : (
            <a key={label} href={href} className={chipClass} style={chipStyle}>
              {label}
            </a>
          )
        )}
      </div>
    </div>
  );
}
