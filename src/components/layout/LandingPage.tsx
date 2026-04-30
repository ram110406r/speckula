"use client";

import React from "react";
import Image from "next/image";
import { Wand2, Lightbulb, CheckSquare, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";

export function LandingPage() {
  const { loginWithGoogle, loading } = useAuth();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center p-6 selection:bg-primary/10">
      {/* Navigation */}
      <nav className="w-full max-w-6xl h-20 flex items-center justify-between px-4 z-10 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image
              src="/logo.png" 
              alt="Speckula Logo" 
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-semibold text-lg tracking-tight text-foreground">Speckula</span>
        </div>
        <div className="flex items-center gap-6">
          <button type="button" onClick={() => scrollToSection("philosophy")} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block">
            Methodology
          </button>
          <Button 
            variant="outline" 
            className="label-system text-[12px] border-border bg-card hover:border-primary/50 hover:text-primary transition-all px-6"
            onClick={loginWithGoogle}
            disabled={loading}
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative z-10 text-center max-w-4xl space-y-10 pt-24 pb-32">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 label-system text-[12px] text-primary animate-fade-in shadow-sm">
          <Image src="/logo.png" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
          <span>The Decision Engine for Product Teams</span>
        </div>
        
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1] text-foreground">
          Build better products. <br /> 
          <span className="text-primary/90 italic serif">With precision.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
          The first AI-native workspace that transforms raw notes into insights, PRDs, and structured roadmaps in seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-6">
          <Button 
            size="lg" 
            className="h-11 px-8 label-system text-[12px] bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all rounded-lg group"
            onClick={loginWithGoogle}
            disabled={loading}
          >
            Get Started for Free
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <Button 
            size="lg" 
            variant="secondary"
            className="h-11 px-8 label-system text-[12px] bg-card border border-border shadow-sm hover:bg-secondary/20 transition-all"
            type="button"
            onClick={() => scrollToSection("features")}
          >
            View Demo
          </Button>
        </div>
      </header>

      {/* Feature Section */}
      <section id="features" className="relative z-10 w-full max-w-6xl pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

      {/* Philosophy Section */}
      <section id="philosophy" className="w-full bg-card border-y border-border py-24 flex flex-col items-center">
        <div className="max-w-3xl text-center space-y-6 px-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Calm. Focused. Precise.</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Product tools are noisy. Speckula is built as a focused environment where the logic of your product wins — no distractions, no dashboards for the sake of dashboards.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-12 w-full max-w-6xl flex flex-col items-center gap-4 border-t border-border/40">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
          <span>Secured with Google Cloud Identity</span>
        </div>
        <p className="text-xs text-muted-foreground/70">© 2026 Speckula</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card border border-border p-8 rounded-xl hover:border-primary/30 transition-colors flex flex-col gap-5">
      <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2 text-foreground tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
