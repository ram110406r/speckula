"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import {
  Wand2, Lightbulb, CheckSquare, ShieldCheck, ArrowRight,
  Loader2, Menu, X, Users, Clock, Zap, Eye, Lock,
  Upload, FileText, Check,
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
    ["Methodology", methodologyRef],
    ["Pricing", pricingRef],
  ];

  return (
    <div className="min-h-screen w-full text-foreground overflow-x-hidden">

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className={`sticky top-0 z-50 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md transition-all duration-300 ${scrolled ? "shadow-md" : "border-b border-slate-200 dark:border-slate-800"}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">

          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Speckula Logo" width={28} height={28} className="object-contain" />
            <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">Speckula</span>
          </div>

          <div className="hidden md:flex items-center gap-7">
            {navLinks.map(([label, ref]) => (
              <button
                key={label}
                type="button"
                onClick={() => scrollTo(ref)}
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {label}
              </button>
            ))}
            <Button
              variant="outline"
              className="h-9 px-5 text-sm border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-all"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Signing in…</> : "Sign In"}
            </Button>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-4 text-sm"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sign In"}
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(v => !v)}
              className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-col gap-1 bg-white dark:bg-slate-950 animate-fade-in">
            {navLinks.map(([label, ref]) => (
              <button
                key={label}
                type="button"
                onClick={() => scrollTo(ref)}
                className="w-full text-left px-3 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative min-h-[calc(100svh-56px)] sm:min-h-[calc(100svh-64px)] bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 flex flex-col items-center justify-center text-white text-center px-4 py-16 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.35),transparent)]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative z-10 max-w-3xl mx-auto space-y-6 sm:space-y-8">
            <div
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-medium uppercase tracking-widest animate-fade-in"
            >
              <Image src="/logo.svg" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain brightness-0 invert" />
              The Decision Engine for Product Teams
            </div>

            <h1
              className="text-3xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight animate-fade-in"
              style={{ animationDelay: "100ms" }}
            >
              Ship products that <br />
              <span className="text-cyan-200 italic font-serif">resonate.</span>
            </h1>

            <p
              className="text-base sm:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed animate-fade-in"
              style={{ animationDelay: "200ms" }}
            >
              Transform scattered customer insights into structured product strategy. AI-native workspace for founders and product teams who move fast.
            </p>

            <p
              className="text-sm text-white/70 animate-fade-in"
              style={{ animationDelay: "300ms" }}
            >
              Used by early-stage founders to validate ideas faster.
            </p>

            <div
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-2 animate-fade-in"
              style={{ animationDelay: "400ms" }}
            >
              <Button
                size="lg"
                className="h-12 sm:h-11 px-8 bg-white text-indigo-600 hover:bg-cyan-50 shadow-lg shadow-black/20 font-medium rounded-lg group active:scale-[0.98] transition-all"
                onClick={loginWithGoogle}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                ) : (
                  <>Get Started for Free <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 sm:h-11 px-8 border-2 border-white/50 text-white hover:bg-white/10 hover:border-white rounded-lg font-medium transition-all"
                onClick={() => scrollTo(featuresRef)}
              >
                See Features
              </Button>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-50 hidden sm:block">
            <div className="w-5 h-8 rounded-full border-2 border-white/40 flex items-start justify-center p-1">
              <div className="w-1 h-2 bg-white/60 rounded-full" />
            </div>
          </div>
        </section>

        {/* ── Social Proof ──────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-slate-900 py-12 sm:py-16 px-4">
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { stat: "500+", label: "Founders Using Speckula", icon: <Users className="h-5 w-5" /> },
                { stat: "4.2h", label: "Saved Per Iteration (Avg)", icon: <Clock className="h-5 w-5" /> },
                { stat: "92%", label: "Faster Insights Extraction", icon: <Zap className="h-5 w-5" /> },
              ].map(({ stat, label, icon }, i) => (
                <AnimateIn key={stat} delay={i * 100}>
                  <div className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      {icon}
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{stat}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{label}</div>
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>

            <AnimateIn delay={300}>
              <div className="p-5 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-800/50 dark:to-indigo-900/10">
                <blockquote className="text-slate-700 dark:text-slate-200 italic leading-relaxed border-l-4 border-indigo-400 pl-4 text-sm sm:text-base">
                  "Speckula turned weeks of customer research into actionable PRDs in hours. It's like having a senior PM on your team."
                </blockquote>
                <div className="mt-3 flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0">S</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Sarah Chen</span> · Founder @ DataFlow AI
                  </p>
                </div>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────────── */}
        <section ref={featuresRef} id="features" className="bg-slate-50 dark:bg-slate-950 py-14 sm:py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <AnimateIn className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
                Everything you need to ship right
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
                From raw discovery to polished PRD — all in one focused workspace.
              </p>
            </AnimateIn>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-7">
              {[
                {
                  icon: <Lightbulb className="h-6 w-6" />,
                  title: "Insights Engine",
                  description: "Automatically extract user pain points and market patterns from your discovery notes. Categorized and prioritized for immediate action.",
                },
                {
                  icon: <Wand2 className="h-6 w-6" />,
                  title: "AI PRD Generator",
                  description: "Go from back-of-the-napkin ideas to a comprehensive PRD with one click. Institutional-grade structure, ready for development.",
                },
                {
                  icon: <CheckSquare className="h-6 w-6" />,
                  title: "Execution Tasks",
                  description: "Translate strategy into action with prioritized tasks and 90-day roadmaps. No more manual backlog grooming.",
                },
              ].map(({ icon, title, description }, i) => (
                <AnimateIn key={title} delay={i * 120}>
                  <FeatureCard icon={icon} title={title} description={description} />
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Methodology ───────────────────────────────────────────────────── */}
        <section ref={methodologyRef} id="methodology" className="bg-white dark:bg-slate-900 py-14 sm:py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <AnimateIn className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
                How It Works
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                Four steps from raw data to shipped feature.
              </p>
            </AnimateIn>

            <div className="space-y-0">
              {[
                { num: "01", icon: <Upload className="h-5 w-5" />, title: "Ingest Raw Notes", description: "Paste customer interviews, reviews, support tickets, or survey responses. Speckula automatically detects and structures the data." },
                { num: "02", icon: <Lightbulb className="h-5 w-5" />, title: "Extract Insights", description: "AI analysis surfaces pain points, feature requests, and patterns. Grouped by theme, prioritized by frequency and impact." },
                { num: "03", icon: <FileText className="h-5 w-5" />, title: "Generate PRD", description: "One click generates a polished, structured PRD. Includes market context, user stories, acceptance criteria, and roadmap." },
                { num: "04", icon: <CheckSquare className="h-5 w-5" />, title: "Execute Tasks", description: "Automatically breaks down PRD into prioritized tasks and sprints. Share with your team and start shipping immediately." },
              ].map(({ num, icon, title, description }, i) => (
                <AnimateIn key={num} delay={i * 100}>
                  <div className="flex gap-5 sm:gap-6">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="h-11 w-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        {icon}
                      </div>
                      {i < 3 && <div className="w-px flex-1 mt-2 mb-2 bg-indigo-200 dark:bg-indigo-800/60 min-h-[32px]" />}
                    </div>
                    <div className={`pt-1.5 ${i < 3 ? "pb-8" : "pb-0"}`}>
                      <div className="text-xs font-mono text-indigo-500 dark:text-indigo-400 mb-1 tracking-widest">{num}</div>
                      <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Philosophy ────────────────────────────────────────────────────── */}
        <section id="philosophy" className="bg-slate-50 dark:bg-slate-950 py-14 sm:py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <AnimateIn className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
                Calm. Focused. Precise.
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Product tools are noisy. Speckula is built as a focused workspace where the logic of your product wins — no distractions, no dashboards for the sake of dashboards.
              </p>
            </AnimateIn>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-7">
              {[
                { icon: <Eye className="h-6 w-6" />, title: "Precision Over Features", description: "Every feature serves a single purpose: faster, better product decisions. No feature bloat." },
                { icon: <Zap className="h-6 w-6" />, title: "Speed Without Sacrifice", description: "AI automation that respects your judgment. You stay in control; the tool amplifies your thinking." },
                { icon: <Lock className="h-6 w-6" />, title: "Your Data, Secure", description: "End-to-end encrypted. Never trained on your data. Privacy by design, always." },
              ].map(({ icon, title, description }, i) => (
                <AnimateIn key={title} delay={i * 120}>
                  <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 h-full">
                    <div className="h-11 w-11 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                      {icon}
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section ref={pricingRef} id="pricing" className="bg-white dark:bg-slate-900 py-14 sm:py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <AnimateIn className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
                Simple, transparent pricing
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                Start free. Scale as your team grows.
              </p>
            </AnimateIn>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-start">
              <AnimateIn delay={0}>
                <PricingCard
                  name="Starter"
                  price="Free"
                  description="For solo founders and small teams"
                  features={["Up to 10 analyses/month", "Basic insight extraction", "AI PRD Generator", "Email support"]}
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
                  features={["Unlimited analyses", "Advanced AI models", "Slack integration", "Priority support", "Task generation"]}
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
                  features={["Custom workflows", "Dedicated account manager", "SSO + advanced security", "SLA guarantee"]}
                  cta="Contact Sales"
                  onCta={() => { window.location.href = "mailto:support@speckula.ai"; }}
                />
              </AnimateIn>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 py-16 sm:py-24 px-4 text-white text-center">
          <AnimateIn>
            <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
                Ready to ship products that resonate?
              </h2>
              <p className="text-white/80 text-base sm:text-lg">
                Join 500+ founders using Speckula to validate ideas faster.
              </p>
              <Button
                size="lg"
                className="h-12 px-8 bg-white text-indigo-600 hover:bg-cyan-50 shadow-lg font-medium rounded-lg group active:scale-[0.98] transition-all"
                onClick={loginWithGoogle}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                ) : (
                  <>Get Started for Free <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </Button>
              <p className="text-sm text-white/60">No credit card required · 7-day free trial of Pro</p>
            </div>
          </AnimateIn>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="bg-slate-900 text-slate-400 py-12 sm:py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              <div className="col-span-2 md:col-span-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Image src="/logo.svg" alt="Speckula" width={22} height={22} className="object-contain brightness-0 invert opacity-80" />
                  <span className="font-semibold text-slate-100">Speckula</span>
                </div>
                <p className="text-sm leading-relaxed">The decision engine for product teams.</p>
              </div>

              <FooterColumn
                title="Product"
                links={[
                  { label: "Features", onClick: () => scrollTo(featuresRef) },
                  { label: "Methodology", onClick: () => scrollTo(methodologyRef) },
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
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Security", href: "#" },
                ]}
              />
            </div>

            <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <p>© 2026 Speckula. All rights reserved.</p>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                <span>Secured with Google Cloud Identity</span>
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 md:p-7 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col gap-4 h-full">
      <div className="h-12 w-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-base md:text-lg font-semibold mb-2 text-slate-900 dark:text-white tracking-tight">{title}</h3>
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
    <div className={`relative rounded-2xl border p-6 sm:p-7 flex flex-col gap-5 transition-all duration-300 ${
      highlighted
        ? "border-indigo-500 bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 md:-translate-y-2"
        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:-translate-y-1 hover:shadow-lg"
    }`}>
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-indigo-600 text-xs font-semibold shadow border border-indigo-100 whitespace-nowrap">
          {badge}
        </div>
      )}
      <div>
        <div className={`text-sm font-semibold mb-1 ${highlighted ? "text-indigo-200" : "text-slate-500 dark:text-slate-400"}`}>{name}</div>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${highlighted ? "text-white" : "text-slate-900 dark:text-white"}`}>{price}</span>
          {period && <span className={`text-sm ${highlighted ? "text-indigo-200" : "text-slate-500 dark:text-slate-400"}`}>{period}</span>}
        </div>
        <p className={`text-sm mt-1.5 ${highlighted ? "text-indigo-200" : "text-slate-600 dark:text-slate-400"}`}>{description}</p>
      </div>
      <ul className="space-y-2.5 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${highlighted ? "text-cyan-300" : "text-indigo-500"}`} />
            <span className={`text-sm ${highlighted ? "text-indigo-100" : "text-slate-700 dark:text-slate-300"}`}>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className={`h-10 w-full rounded-lg font-medium transition-all active:scale-[0.98] ${
          highlighted
            ? "bg-white text-indigo-600 hover:bg-cyan-50 shadow-md"
            : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
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
      <h4 className="text-sm font-semibold text-slate-100 mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map(({ label, href, onClick }) => (
          <li key={label}>
            {onClick ? (
              <button type="button" onClick={onClick} className="text-sm hover:text-slate-100 transition-colors text-left">
                {label}
              </button>
            ) : (
              <a href={href} className="text-sm hover:text-slate-100 transition-colors">{label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
