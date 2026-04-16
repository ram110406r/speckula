"use client";

import React from "react";
import Image from "next/image";
import { Wand2, Lightbulb, CheckSquare, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";

export function LandingPage() {
  const { loginWithGoogle, loading } = useAuth();

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center p-6 selection:bg-primary/10">
      {/* Navigation */}
      <nav className="w-full max-w-6xl h-20 flex items-center justify-between px-4 z-10 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image
              src="/logo.png" 
              alt="Buildcase Logo" 
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-semibold text-lg tracking-tight text-foreground">Buildcase</span>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block">
            Methodology
          </button>
          <Button 
            variant="outline" 
            className="label-system text-[12px] border-border bg-white hover:border-primary/50 hover:text-primary transition-all px-6"
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
            className="h-11 px-8 label-system text-[12px] bg-white border border-border shadow-sm hover:bg-secondary/20 transition-all"
          >
            View Demo
          </Button>
        </div>
      </header>

      {/* Feature Section */}
      <section className="relative z-10 w-full max-w-6xl pb-32">
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
      <section className="w-full bg-white border-y border-border py-24 flex flex-col items-center">
        <div className="max-w-4xl text-center space-y-8 px-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">The Decision Instrument Philosophy</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Standard product tools are too noisy. Buildcase is built to be a calm, focused environment where the logic of your product wins. No distractions, no neon glows—just pure product intelligence.
          </p>
          <div className="pt-8 flex flex-wrap justify-center gap-12 opacity-60">
            <LogoPlaceholder name="Linear" />
            <LogoPlaceholder name="Vercel" />
            <LogoPlaceholder name="Figma" />
            <LogoPlaceholder name="Raycast" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-16 w-full max-w-6xl flex flex-col items-center gap-8 border-t border-border/40">
        <div className="flex items-center gap-3 label-system text-[12px] opacity-60 normal-case">
          <ShieldCheck className="h-4 w-4 text-primary/60" />
          <span>Secure with Google Cloud Identity & Private Workspaces</span>
        </div>
        <div className="flex items-center gap-8 label-system text-[12px]">
          <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          <a href="#" className="hover:text-primary transition-colors">Terms</a>
          <a href="#" className="hover:text-primary transition-colors">Twitter</a>
        </div>
        <p className="label-system text-[12px] lowercase opacity-40">
          © 2026 Buildcase. Minimal. Calm. Precise.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white border border-border p-10 rounded-xl hover:shadow-xl hover:shadow-primary/5 transition-all group flex flex-col gap-6">
      <div className="w-12 h-12 rounded-lg bg-background border border-border flex items-center justify-center text-primary transition-transform group-hover:scale-105 duration-300 shadow-sm">
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-3 text-foreground tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground/90 leading-relaxed font-medium">{description}</p>
      </div>
      <div className="mt-auto pt-4 flex items-center gap-2 label-system text-[12px] group-hover:text-primary transition-colors">
        Learn More <ArrowRight className="h-3 w-3" />
      </div>
    </div>
  );
}

function LogoPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-default group">
      <div className="w-5 h-5 bg-foreground/10 rounded-sm group-hover:bg-primary/20 transition-colors" />
      <span className="label-system text-[12px] lowercase opacity-40 group-hover:opacity-80 transition-all">{name}</span>
    </div>
  );
}
