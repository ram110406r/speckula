import React from "react";
import {
  Loader2, Check, ChevronRight, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLOR, SERIF } from "./tokens";

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="inline-block text-xs sm:text-sm font-medium uppercase tracking-[0.15em] px-3 py-1 rounded-full"
      style={{ color: COLOR.ink, backgroundColor: COLOR.paper, border: `1px solid ${COLOR.ink}` }}
    >
      {children}
    </p>
  );
}

export function WorkflowStage({
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
      className="flex-1 min-w-0 rounded-xl p-4 sm:p-5 transition-colors"
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

export function WorkflowArrow() {
  return (
    <div className="flex items-center justify-center shrink-0 lg:px-1" style={{ color: COLOR.mute }}>
      <ChevronDown className="h-5 w-5 lg:hidden" />
      <ChevronRight className="h-5 w-5 hidden lg:block" />
    </div>
  );
}

export function FeatureCard({
  icon, title, description, position, accentTint, visual,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  position: "first" | "middle" | "last";
  accentTint?: string;
  visual?: React.ReactNode;
}) {
  return (
    <div
      className="p-7 sm:p-8 lg:p-10 h-full flex flex-col gap-5 group transition-colors duration-300 hover:bg-[color:var(--card-hover)]"
      style={{
        backgroundColor: COLOR.paper,
        borderLeft: position === "first" ? "none" : `1px solid ${COLOR.ink}`,
        ["--card-hover" as string]: COLOR.cream,
      }}
    >
      <div
        className="h-11 w-11 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{ backgroundColor: accentTint ?? COLOR.lilac, color: COLOR.ink, border: `1px solid ${COLOR.ink}` }}
      >
        {icon}
      </div>
      <div className="flex-1 space-y-2.5">
        <h3 className="text-xl sm:text-2xl font-medium tracking-tight" style={{ color: COLOR.ink }}>{title}</h3>
        <p className="text-base leading-[1.65]" style={{ color: COLOR.mute }}>{description}</p>
      </div>
      {visual && (
        <div
          className="mt-2 rounded-lg p-3 sm:p-4"
          style={{ backgroundColor: COLOR.cream, border: `1px solid ${COLOR.ink}` }}
        >
          {visual}
        </div>
      )}
    </div>
  );
}

export function PricingCard({
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

export function FooterChipGroup({ label, chips }: {
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
