"use client";

import React from "react";
import { Sparkles, Wand2, Lightbulb, CheckSquare, Layout, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/AuthProvider";

export function LandingPage() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div className="min-h-screen w-full bg-[#030303] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Nav */}
      <div className="absolute top-0 w-full max-w-7xl h-20 flex items-center justify-between px-8 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Buildcase</span>
        </div>
        <Button 
          variant="ghost" 
          className="text-sm font-medium hover:bg-white/5"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          Sign In
        </Button>
      </div>

      {/* Hero Section */}
      <div className="relative z-10 text-center max-w-3xl space-y-8 mt-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary-foreground/80 backdrop-blur-sm animate-fade-in">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>The Decision Engine for Product Teams</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
          Build better products. <br /> Effortlessly.
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
          The first AI-native workspace that transforms your raw notes into insights, PRDs, and execution tasks in seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button 
            size="lg" 
            className="h-14 px-8 text-base font-semibold bg-primary text-white hover:bg-primary/90 shadow-2xl shadow-primary/20 w-full sm:w-auto"
            onClick={signInWithGoogle}
            disabled={loading}
          >
            Get Started for Free
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="h-14 px-8 text-base font-semibold border-white/10 bg-white/5 hover:bg-white/10 w-full sm:w-auto"
          >
            How it works
          </Button>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mt-24">
        <FeatureCard 
          icon={<Lightbulb className="h-6 w-6" />}
          title="Insights Engine"
          description="Automatically extract user pain points and market opportunities from your discovery notes."
          color="text-yellow-400"
        />
        <FeatureCard 
          icon={<Wand2 className="h-6 w-6" />}
          title="AI PRD Generator"
          description="Go from back-of-the-napkin ideas to a comprehensive PRD with one click."
          color="text-primary"
        />
        <FeatureCard 
          icon={<CheckSquare className="h-6 w-6" />}
          title="Execution Tasks"
          description="Translate strategy into action with prioritized tasks and 90-day roadmaps."
          color="text-green-400"
        />
      </div>

      {/* Social Proof / Trust */}
      <div className="relative z-10 mt-32 flex flex-col items-center gap-8 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Trusted by teams at</p>
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-8 px-4">
          <LogoPlaceholder name="Linear" />
          <LogoPlaceholder name="Vercel" />
          <LogoPlaceholder name="Figma" />
          <LogoPlaceholder name="Stripe" />
        </div>
      </div>
      
      <div className="mt-24 border-t border-white/5 py-8 w-full flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
          <ShieldCheck className="h-3 w-3" />
          <span>Secure with Google Cloud Identity</span>
        </div>
        <p className="text-[10px] text-muted-foreground/50">© 2026 Buildcase. Built by AI for builders.</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-2xl hover:bg-white/[0.05] transition-all group backdrop-blur-sm">
      <div className={`mb-4 ${color} transition-transform group-hover:scale-110 duration-300`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground/80 leading-relaxed">{description}</p>
    </div>
  );
}

function LogoPlaceholder({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 bg-white/20 rounded-sm" />
      <span className="font-bold text-sm tracking-tight">{name}</span>
    </div>
  );
}
