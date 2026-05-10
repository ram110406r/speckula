"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState("");
  const [sent,  setSent]    = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("Please enter a valid email address."); return; }
    setSent(true);
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
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-4" />
              <h1 className="text-lg font-semibold text-foreground">Check your email</h1>
              <p className="text-sm text-muted-foreground mt-2">
                We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-4">Didn't receive it? Check your spam folder or{" "}
                <button onClick={() => setSent(false)} className="text-primary hover:underline">try again</button>
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-lg font-semibold text-foreground">Reset password</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your email and we'll send a reset link
                </p>
              </div>

              {error && (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    required
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-border/60 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Send reset link
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/auth/sign-in"
              className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
