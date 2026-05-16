"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import {
  Wand2, Lightbulb, CheckSquare, ArrowRight,
  Loader2, Menu, X, Clock, Zap, Eye, Lock,
  Upload, FileText, Check, Shield, Lock as LockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";

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

function AnimateIn({ children, delay = 0, className = "" }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"} ${className}`}
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
    <div className="min-h-screen w-full text-foreground overflow-x-hidden">

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className={`sticky top-0 z-50 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md transition-all duration-300 ${scrolled ? "shadow-md" : "border-b border-slate-200 dark:border-slate-800"}`}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">

          <div className="flex items-center gap-2.5 shrink-0">
            <Image src="/logo.png" alt="Speckula Logo" width={48} height={48} className="object-contain scale-[1.7]" />
            <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white hidden sm:inline">Speckula</span>
          </div>

          <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
            {navLinks.map(([label, ref]) => (
              <button
                key={label}
                type="button"
                onClick={() => scrollTo(ref)}
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="outline"
              className="h-9 px-5 text-sm border-slate-300 dark:border-slate-700 hover:border-slate-400 hover:text-slate-900 dark:hover:border-slate-600 dark:hover:text-slate-100 transition-all"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Signing in…</> : "Sign In"}
            </Button>
          </div>

          <div className="flex md:hidden items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3 text-xs sm:text-sm rounded-lg"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sign In"}
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
              className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-4 flex flex-col gap-2 bg-white dark:bg-slate-950 animate-fade-in">
            {navLinks.map(([label, ref]) => (
              <button
                key={label}
                type="button"
                onClick={() => scrollTo(ref)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors active:bg-slate-100 dark:active:bg-slate-800"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative min-h-[100svh] sm:min-h-[calc(100svh-64px)] bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center text-slate-900 dark:text-white px-4 sm:px-6 py-16 sm:py-24 overflow-hidden">

          {/* Subtle background grid */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative z-10 w-full max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">

              {/* Left: Copy & CTA */}
              <div className="space-y-6 sm:space-y-8">
                <AnimateIn className="space-y-3 sm:space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 w-fit">
                    <Zap className="h-3.5 w-3.5" />
                    <span>AI-powered product decisions</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                    Turn market signals into winning strategy
                  </h1>

                  <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
                    Speckula transforms raw customer data into actionable insights and polished PRDs. Ship better products in half the time.
                  </p>
                </AnimateIn>

                {/* CTA Buttons */}
                <AnimateIn delay={100} className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    size="lg"
                    className="h-12 px-6 sm:px-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-semibold rounded-lg group active:scale-[0.98] transition-all text-base"
                    onClick={loginWithGoogle}
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                    ) : (
                      <>Get Started Free <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform hidden sm:inline" /></>
                    )}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 sm:px-8 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-semibold transition-all text-base"
                    onClick={() => scrollTo(methodologyRef)}
                  >
                    See How It Works
                  </Button>
                </AnimateIn>

                <AnimateIn delay={150} className="text-sm text-slate-600 dark:text-slate-400">
                  <p>No credit card required. 7-day free trial, then $0-49/month.</p>
                </AnimateIn>
              </div>

              {/* Right: Product Preview */}
              <AnimateIn delay={200} className="lg:col-span-1">
                <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-300 dark:border-slate-600">
                  {/* Placeholder for product screenshot - replace with real image */}
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="flex justify-center">
                        <div className="h-16 w-16 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center opacity-20">
                          <Lightbulb className="h-8 w-8" />
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Product Screenshot</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 max-w-xs mx-auto">Replace with real product image showing insights dashboard and PRD generation</p>
                    </div>
                  </div>
                </div>

                {/* Trust badges below image */}
                <div className="mt-6 flex flex-wrap gap-4 justify-center lg:justify-start">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Shield className="h-4 w-4" />
                    <span>SOC 2 Type II</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <LockIcon className="h-4 w-4" />
                    <span>GDPR Compliant</span>
                  </div>
                </div>
              </AnimateIn>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-30 hidden sm:block">
            <div className="w-5 h-8 rounded-full border-2 border-slate-400 flex items-start justify-center p-1">
              <div className="w-1 h-2 bg-slate-400 rounded-full" />
            </div>
          </div>
        </section>

        {/* ── Social Proof ──────────────────────────────────────────────────── */}
        <section className="bg-slate-50 dark:bg-slate-900 py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 border-y border-slate-200 dark:border-slate-800">
          <div className="w-full max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              {[
                { metric: "4,000+", label: "Decisions Analyzed", icon: <CheckSquare className="h-5 w-5" /> },
                { metric: "2.5h", label: "Avg Time to PRD", icon: <Clock className="h-5 w-5" /> },
                { metric: "89%", label: "On-Time Shipping", icon: <Zap className="h-5 w-5" /> },
              ].map(({ metric, label, icon }, i) => (
                <AnimateIn key={metric} delay={i * 100}>
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                      {icon}
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">{metric}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section ref={featuresRef} id="features" className="bg-white dark:bg-slate-950 py-14 sm:py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-3 sm:space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                Core capabilities
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Everything your team needs to turn insights into shipped features.
              </p>
            </AnimateIn>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 lg:gap-8">
              {[
                {
                  icon: <Lightbulb className="h-6 w-6" />,
                  title: "Insights Engine",
                  description: "Automatically surface pain points from customer data. Grouped by theme, prioritized by impact.",
                },
                {
                  icon: <Wand2 className="h-6 w-6" />,
                  title: "AI PRD Generator",
                  description: "One click generates polished PRDs with market context, user stories, and acceptance criteria.",
                },
                {
                  icon: <CheckSquare className="h-6 w-6" />,
                  title: "Task Breakdown",
                  description: "Automatically convert strategy into prioritized tasks. Share with your team and start shipping.",
                },
              ].map(({ icon, title, description }, i) => (
                <AnimateIn key={title} delay={i * 100}>
                  <FeatureCard icon={icon} title={title} description={description} />
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works (Simplified) ────────────────────────────────────── */}
        <section ref={methodologyRef} id="methodology" className="bg-slate-50 dark:bg-slate-900 py-14 sm:py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-y border-slate-200 dark:border-slate-800">
          <div className="w-full max-w-4xl mx-auto">
            <AnimateIn className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-3 sm:space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                How it works
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                From raw data to shipped feature in three steps.
              </p>
            </AnimateIn>

            <div className="space-y-8 sm:space-y-10">
              {[
                { num: "01", time: "5 min", icon: <Upload className="h-5 w-5" />, title: "Ingest Data", description: "Paste customer interviews, reviews, or survey responses. Speckula structures everything automatically." },
                { num: "02", time: "2 min", icon: <Lightbulb className="h-5 w-5" />, title: "Extract Insights", description: "AI analysis surfaces pain points and patterns. Grouped by theme, ready for strategy." },
                { num: "03", time: "1 min", icon: <FileText className="h-5 w-5" />, title: "Generate PRD", description: "One click generates a polished, production-ready PRD with all context and acceptance criteria." },
              ].map(({ num, time, icon, title, description }, i) => (
                <AnimateIn key={num} delay={i * 100}>
                  <div className="flex gap-4 sm:gap-6 lg:gap-8">
                    <div className="flex flex-col items-center shrink-0 pt-1">
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shrink-0 font-semibold text-lg">
                        {num}
                      </div>
                      {i < 2 && <div className="w-px flex-1 mt-4 mb-4 bg-slate-300 dark:bg-slate-700 min-h-[56px] sm:min-h-[64px]" />}
                    </div>
                    <div className="pt-2 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">{time}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-base">{description}</p>
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Philosophy ────────────────────────────────────────────────────── */}
        <section id="philosophy" className="bg-white dark:bg-slate-950 py-14 sm:py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-3 sm:space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                Built for teams who move fast
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Speckula gets out of your way. Clear, focused, precise.
              </p>
            </AnimateIn>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 lg:gap-8">
              {[
                { icon: <Eye className="h-6 w-6" />, title: "Crystal Clear", description: "No feature bloat. Every tool serves one purpose: better decisions faster." },
                { icon: <Zap className="h-6 w-6" />, title: "AI That Respects Control", description: "Automation handles the grunt work. You stay in the driver's seat." },
                { icon: <Lock className="h-6 w-6" />, title: "Privacy First", description: "End-to-end encrypted. Never trained on your data. Your team's secrets stay secret." },
              ].map(({ icon, title, description }, i) => (
                <AnimateIn key={title} delay={i * 100}>
                  <div className="p-6 sm:p-7 lg:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                    <div className="h-11 w-11 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 mb-4 shrink-0">
                      {icon}
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">{title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex-1">{description}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section ref={pricingRef} id="pricing" className="bg-slate-50 dark:bg-slate-900 py-14 sm:py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-y border-slate-200 dark:border-slate-800">
          <div className="w-full max-w-6xl mx-auto">
            <AnimateIn className="text-center mb-12 sm:mb-16 lg:mb-20 space-y-3 sm:space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                Simple, transparent pricing
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Start free. Scale as you grow.
              </p>
            </AnimateIn>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 lg:gap-8 items-stretch">
              <AnimateIn delay={0}>
                <PricingCard
                  name="Starter"
                  price="Free"
                  description="For solo founders getting started"
                  features={["10 analyses/month", "Basic insight extraction", "AI PRD generator", "Email support"]}
                  cta="Get Started"
                  onCta={loginWithGoogle}
                  loading={loading}
                />
              </AnimateIn>
              <AnimateIn delay={100}>
                <PricingCard
                  name="Pro"
                  price="$49"
                  period="/month"
                  description="For growing product teams"
                  features={["Unlimited analyses", "Advanced AI models", "Task generation", "Slack integration", "Priority support"]}
                  cta="Start Free Trial"
                  onCta={loginWithGoogle}
                  loading={loading}
                  highlighted
                  badge="Most Popular"
                />
              </AnimateIn>
              <AnimateIn delay={200}>
                <PricingCard
                  name="Enterprise"
                  price="Custom"
                  description="For large organizations"
                  features={["Custom workflows", "Dedicated account manager", "SSO & advanced security", "SLA guarantee"]}
                  cta="Contact Sales"
                  onCta={() => { window.location.href = "mailto:support@speckula.ai"; }}
                />
              </AnimateIn>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="bg-slate-900 dark:bg-slate-950 py-16 sm:py-24 lg:py-32 px-4 sm:px-6 text-white text-center overflow-hidden">
          <AnimateIn>
            <div className="relative z-10 w-full max-w-2xl mx-auto space-y-6 sm:space-y-8">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                Ready to ship better products faster?
              </h2>
              <p className="text-white/70 text-base sm:text-lg leading-relaxed">
                Join founders who've cut their product cycle in half.
              </p>
              <Button
                size="lg"
                className="h-12 px-6 sm:px-8 bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-black/20 font-semibold rounded-lg group active:scale-[0.98] transition-all text-base inline-flex"
                onClick={loginWithGoogle}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                ) : (
                  <>Get Started Free <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform hidden sm:inline" /></>
                )}
              </Button>
              <p className="text-sm text-white/50">No credit card required. 7-day free trial.</p>
            </div>
          </AnimateIn>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="bg-slate-950 text-slate-400 py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
          <div className="w-full max-w-6xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12">
              <div className="col-span-2 sm:col-span-1 space-y-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Image src="/logo.png" alt="Speckula" width={22} height={22} className="object-contain brightness-0 invert opacity-80" />
                  <span className="font-semibold text-slate-100 text-sm">Speckula</span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed">The decision engine for product teams.</p>
              </div>

              <FooterColumn
                title="Product"
                links={[
                  { label: "Features", onClick: () => scrollTo(featuresRef) },
                  { label: "How It Works", onClick: () => scrollTo(methodologyRef) },
                  { label: "Pricing", onClick: () => scrollTo(pricingRef) },
                ]}
              />
              <FooterColumn
                title="Company"
                links={[
                  { label: "About", href: "#" },
                  { label: "Contact", href: "mailto:support@speckula.ai" },
                ]}
              />
              <FooterColumn
                title="Legal"
                links={[
                  { label: "Privacy", href: "/privacy" },
                  { label: "Terms", href: "/terms" },
                  { label: "Security", href: "#" },
                ]}
              />
            </div>

            <div className="border-t border-slate-800 pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
              <p>© 2026 Speckula. All rights reserved.</p>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  <span>SOC 2 Type II</span>
                </div>
                <span>·</span>
                <div className="flex items-center gap-1">
                  <LockIcon className="h-3.5 w-3.5" />
                  <span>GDPR Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 lg:p-8 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col gap-4 h-full">
      <div className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-slate-900 dark:text-white tracking-tight">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function PricingCard({
  name, price, period, description, features, cta, onCta, loading, highlighted, badge,
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
}) {
  return (
    <div className={`relative rounded-2xl border p-6 sm:p-7 lg:p-8 flex flex-col gap-6 transition-all duration-300 ${
      highlighted
        ? "border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/20 dark:shadow-white/10 lg:-translate-y-3"
        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:-translate-y-1 hover:shadow-lg"
    }`}>
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow border border-slate-800 dark:border-slate-200 whitespace-nowrap">
          {badge}
        </div>
      )}
      <div>
        <div className={`text-xs sm:text-sm font-semibold mb-2 uppercase tracking-wide ${highlighted ? "text-white/70 dark:text-slate-900/70" : "text-slate-500 dark:text-slate-400"}`}>{name}</div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-4xl sm:text-5xl font-bold ${highlighted ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-white"}`}>{price}</span>
          {period && <span className={`text-sm ${highlighted ? "text-white/70 dark:text-slate-900/70" : "text-slate-500 dark:text-slate-400"}`}>{period}</span>}
        </div>
        <p className={`text-sm mt-2 ${highlighted ? "text-white/80 dark:text-slate-900/80" : "text-slate-600 dark:text-slate-400"}`}>{description}</p>
      </div>
      <ul className="space-y-3 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${highlighted ? "text-white/60 dark:text-slate-900/60" : "text-slate-400 dark:text-slate-600"}`} />
            <span className={`text-sm ${highlighted ? "text-white/90 dark:text-slate-900/90" : "text-slate-700 dark:text-slate-300"}`}>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className={`h-11 sm:h-10 w-full rounded-lg font-semibold transition-all active:scale-[0.98] text-base sm:text-sm ${
          highlighted
            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shadow-md"
            : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
        }`}
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

function FooterColumn({ title, links }: {
  title: string;
  links: Array<{ label: string; href?: string; onClick?: () => void }>;
}) {
  return (
    <div>
      <h4 className="text-xs sm:text-sm font-semibold text-slate-100 mb-3 sm:mb-4 uppercase tracking-wider">{title}</h4>
      <ul className="space-y-2">
        {links.map(({ label, href, onClick }) => (
          <li key={label}>
            {onClick ? (
              <button type="button" onClick={onClick} className="text-xs sm:text-sm hover:text-slate-100 transition-colors text-left py-1 active:text-slate-200">
                {label}
              </button>
            ) : (
              <a href={href} className="text-xs sm:text-sm hover:text-slate-100 transition-colors inline-block py-1">{label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
