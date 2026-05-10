"use client";

import React, { useState } from "react";
import {
  CreditCard, Zap, Check, ArrowRight, Download,
  AlertCircle, TrendingUp, Users, FileText, Brain
} from "lucide-react";

type Plan = "starter" | "pro" | "team" | "enterprise";

const PLANS = [
  {
    id: "starter" as Plan,
    name: "Starter",
    price: 0,
    description: "For solo PMs getting started",
    features: ["3 active analyses", "50 signals/month", "5 decisions", "1 user", "7-day history"],
    limits: { analyses: 3, signals: 50, users: 1 },
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    price: 29,
    description: "For serious product managers",
    features: ["Unlimited analyses", "500 signals/month", "Unlimited decisions", "Chrome extension", "30-day history", "API access"],
    limits: { analyses: -1, signals: 500, users: 1 },
    popular: true,
  },
  {
    id: "team" as Plan,
    name: "Team",
    price: 79,
    description: "For product teams",
    features: ["Everything in Pro", "Up to 10 users", "Team signals & decisions", "Shared workspaces", "Priority support", "90-day history"],
    limits: { analyses: -1, signals: 2000, users: 10 },
  },
  {
    id: "enterprise" as Plan,
    name: "Enterprise",
    price: null,
    description: "For large organisations",
    features: ["Everything in Team", "Unlimited users", "SSO / SAML", "Custom data retention", "SLA guarantee", "Dedicated support"],
    limits: { analyses: -1, signals: -1, users: -1 },
  },
];

const USAGE = [
  { label: "Analyses",      used: 2,   limit: 3,   icon: FileText,  color: "bg-primary"      },
  { label: "Signals",       used: 38,  limit: 50,  icon: Brain,     color: "bg-amber-500"    },
  { label: "Team members",  used: 1,   limit: 1,   icon: Users,     color: "bg-blue-500"     },
];

const INVOICES = [
  { date: "May 1, 2026",   amount: "$0.00", plan: "Starter", status: "paid" },
  { date: "Apr 1, 2026",   amount: "$0.00", plan: "Starter", status: "paid" },
  { date: "Mar 1, 2026",   amount: "$0.00", plan: "Starter", status: "paid" },
];

export function BillingView() {
  const [currentPlan]   = useState<Plan>("starter");
  const [billing]       = useState<"monthly" | "yearly">("monthly");
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-background custom-scrollbar">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Billing & Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription and usage</p>
        </div>

        {/* ── Current plan banner ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-xl border border-border/60 bg-card">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Starter plan</p>
              <p className="text-xs text-muted-foreground">Free forever · Renews automatically</p>
            </div>
          </div>
          <button
            onClick={() => setShowUpgrade(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Upgrade plan
          </button>
        </div>

        {/* ── Usage ── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Current usage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {USAGE.map((u) => {
              const pct     = u.limit > 0 ? (u.used / u.limit) * 100 : 0;
              const isHigh  = pct >= 80;
              return (
                <div key={u.label} className="p-4 rounded-xl border border-border/60 bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <u.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{u.label}</span>
                  </div>
                  <div className="text-lg font-bold text-foreground">{u.used} <span className="text-sm text-muted-foreground font-normal">/ {u.limit}</span></div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isHigh ? "bg-amber-500" : u.color}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  {isHigh && (
                    <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Approaching limit
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Plan comparison (shown on upgrade) ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Plans</h2>
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border/60 bg-muted">
              {(["monthly", "yearly"] as const).map((b) => (
                <button
                  key={b}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                    billing === b ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {b}
                  {b === "yearly" && <span className="ml-1 text-green-600 text-[10px]">-20%</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col gap-4 p-4 rounded-xl border transition-all ${
                    plan.popular
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-card"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold whitespace-nowrap">
                      Most popular
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{plan.description}</p>
                  </div>
                  <div>
                    {plan.price === null ? (
                      <span className="text-lg font-bold text-foreground">Custom</span>
                    ) : (
                      <span className="text-lg font-bold text-foreground">
                        {plan.price === 0 ? "Free" : `$${plan.price}`}
                        {plan.price > 0 && <span className="text-xs text-muted-foreground font-normal">/mo</span>}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Check className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={isCurrent}
                    className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                      isCurrent
                        ? "bg-muted text-muted-foreground cursor-default"
                        : plan.popular
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : plan.price === null
                        ? "border border-border/60 text-foreground hover:bg-muted"
                        : "border border-border/60 text-foreground hover:bg-muted"
                    }`}
                  >
                    {isCurrent ? "Current plan" : plan.price === null ? "Contact sales" : "Upgrade"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Payment method ── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Payment method</h2>
          <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border/60 bg-card">
            <div className="p-2 rounded-lg bg-muted">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground flex-1">No payment method on file — required to upgrade</p>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <CreditCard className="h-3 w-3" /> Add card
            </button>
          </div>
        </div>

        {/* ── Invoice history ── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Invoice history</h2>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/50">
                  {["Date", "Plan", "Amount", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground">{inv.date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.plan}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{inv.amount}</td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-medium">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Download className="h-3 w-3" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
