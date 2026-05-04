"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { Wand2, Lightbulb, CheckSquare, ShieldCheck, ArrowRight, Loader2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";

export function LandingPage() {
  const { loginWithGoogle, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const featuresRef = useRef<HTMLElement>(null);
  const philosophyRef = useRef<HTMLElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center px-4 py-4 sm:p-6 selection:bg-primary/10">

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="w-full max-w-6xl flex flex-col z-20 border-b border-border/40">
        <div className="h-16 sm:h-20 flex items-center justify-between px-2 sm:px-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image src="/logo.svg" alt="Speckula Logo" width={32} height={32} className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">Speckula</span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            <button
              type="button"
              onClick={() => scrollTo(philosophyRef)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Methodology
            </button>
            <Button
              variant="outline"
              className="label-system text-[12px] min-h-[44px] border-border bg-card hover:border-primary/50 hover:text-primary transition-all px-6"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </div>

          {/* Mobile: Sign In + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="label-system text-[12px] min-h-[44px] border-border bg-card hover:border-primary/50 hover:text-primary transition-all px-4"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sign In"}
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-2.5 rounded-md hover:bg-muted transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-muted-foreground" /> : <Menu className="h-5 w-5 text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 py-3 px-2 flex flex-col gap-1 animate-fade-in">
            <button
              type="button"
              onClick={() => scrollTo(featuresRef)}
              className="w-full text-left px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollTo(philosophyRef)}
              className="w-full text-left px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Methodology
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <header className="relative z-10 text-center max-w-4xl space-y-6 md:space-y-8 pt-8 pb-10 md:pt-20 md:pb-28">

        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 label-system text-[12px] text-primary animate-fade-in shadow-sm">
          <Image src="/logo.svg" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
          <span>The Decision Engine for Product Teams</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1] text-foreground">
          Build better products. <br />
          <span className="text-primary/90 italic font-serif">With precision.</span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
          The first AI-native workspace that transforms raw notes into insights, PRDs, and structured roadmaps in seconds.
        </p>

        {/* Trust signal */}
        <p className="text-sm text-muted-foreground/70 font-medium">
          Used by early-stage founders to validate ideas faster.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4 w-full sm:w-auto">
          <Button
            size="lg"
            className="h-12 sm:h-11 w-full sm:w-auto px-8 label-system text-[12px] bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all rounded-lg group"
            onClick={loginWithGoogle}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Get Started for Free
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="h-12 sm:h-11 w-full sm:w-auto px-8 label-system text-[12px] bg-card border border-border shadow-sm hover:bg-secondary/20 transition-all"
            type="button"
            onClick={() => scrollTo(featuresRef)}
          >
            See Features
          </Button>
        </div>
      </header>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section ref={featuresRef} id="features" className="relative z-10 w-full max-w-6xl pb-10 md:pb-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-8">
          <FeatureCard
            icon={<Lightbulb className="h-6 w-6" />}
            title="Insights Engine"
            description="Automatically extract user pain points and market patterns from your discovery notes. Categorized and prioritized for immediate action."
          />
          <FeatureCard
            icon={<Wand2 className="h-6 w-6" />}
            title="AI PRD Generator"
            description="Go from back-of-the-napkin ideas to a comprehensive PRD with one click. Institutional grade structure, ready for development."
          />
          <FeatureCard
            icon={<CheckSquare className="h-6 w-6" />}
            title="Execution Tasks"
            description="Translate strategy into action with prioritized tasks and 90-day roadmaps. No more manual backlog grooming."
          />
        </div>
      </section>

      {/* ── Philosophy ──────────────────────────────────────────────────────── */}
      <section ref={philosophyRef} id="philosophy" className="w-full bg-card border-y border-border py-14 md:py-24 flex flex-col items-center">
        <div className="max-w-3xl text-center space-y-4 md:space-y-6 px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">Calm. Focused. Precise.</h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Product tools are noisy. Speckula is built as a focused environment where the logic of your product wins — no distractions, no dashboards for the sake of dashboards.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="mt-auto py-8 md:py-12 w-full max-w-6xl flex flex-col items-center gap-4 border-t border-border/40">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
          <span>Secured with Google Cloud Identity</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
          <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
        </div>
        <p className="text-xs text-muted-foreground/50">© 2026 Speckula</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card border border-border p-5 sm:p-6 rounded-xl hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg transition-all duration-200 flex flex-col gap-4">
      <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold mb-2 text-foreground tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
