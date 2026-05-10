"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { useAuth } from "@/lib/firebase/AuthProvider";

const PERKS = [
  "Capture competitive intelligence automatically",
  "Make evidence-backed product decisions",
  "Generate specs with AI assistance",
  "Free forever — no credit card needed",
];

export default function SignUpPage() {
  const { loginWithGoogle, loading } = useAuth();
  const router = useRouter();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignUp = async () => {
    setIsSigningUp(true);
    setError(null);
    try {
      await loginWithGoogle();
      router.push("/onboarding/welcome");
    } catch {
      setError("Sign up failed. Please try again.");
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center">
              <Image src="/logo.png" alt="Speckula" width={36} height={36} className="object-contain" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">Speckula</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-lg">
          <div className="text-center mb-6">
            <h1 className="text-lg font-semibold text-foreground">Start for free</h1>
            <p className="text-sm text-muted-foreground mt-1">Build your product brain today</p>
          </div>

          {/* Perks */}
          <ul className="space-y-2 mb-6">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Check className="h-3 w-3 text-green-500 shrink-0" />
                {p}
              </li>
            ))}
          </ul>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignUp}
            disabled={isSigningUp || loading}
            className="w-full flex items-center justify-center gap-3 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSigningUp ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
              </svg>
            )}
            Sign up with Google
          </button>

          <div className="mt-4 text-center">
            <p className="text-[11px] text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/sign-in" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          By signing up you agree to our{" "}
          <a href="#" className="underline hover:text-foreground">Terms</a> and{" "}
          <a href="#" className="underline hover:text-foreground">Privacy Policy</a>
        </p>

      </div>
    </div>
  );
}
