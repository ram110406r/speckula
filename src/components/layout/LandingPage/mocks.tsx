import React from "react";
import { Upload, FileText, Check } from "lucide-react";
import { COLOR } from "./tokens";

/* ── Small product mocks for feature cards / how-it-works steps ──────────── */

export function PasteAreaMock() {
  // Reads as: a textarea-style preview with placeholder transcript lines.
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: COLOR.mute }}>
        <Upload className="h-3 w-3" />
        <span>transcript-04.txt</span>
      </div>
      <div className="space-y-1">
        {["w-full", "w-5/6", "w-11/12", "w-3/4", "w-4/6"].map((cls, i) => (
          <div key={i} className={`h-1.5 ${cls} rounded`} style={{ backgroundColor: COLOR.lilac }} />
        ))}
      </div>
    </div>
  );
}

export function ThemeChipsMock() {
  // Reads as: clustered themes with severity counts — what the Insights Engine outputs.
  const themes: Array<[string, number, string]> = [
    ["Slow onboarding", 47, COLOR.peach],
    ["Pricing confusion", 31, COLOR.butter],
    ["Mobile bugs", 28, COLOR.mint],
    ["Missing exports", 19, COLOR.lilac],
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {themes.map(([label, count, tint]) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium"
          style={{ backgroundColor: tint, color: COLOR.ink, border: `1px solid ${COLOR.ink}` }}
        >
          <span>{label}</span>
          <span className="px-1.5 rounded-full text-[10px]" style={{ backgroundColor: COLOR.paper, border: `1px solid ${COLOR.ink}` }}>
            {count}
          </span>
        </span>
      ))}
    </div>
  );
}

export function DocPreviewMock() {
  // Reads as: PRD section headers with body skeleton lines.
  return (
    <div className="space-y-2 font-mono text-[10px]" style={{ color: COLOR.ink }}>
      <div className="flex items-center gap-1.5">
        <FileText className="h-3 w-3" />
        <span className="font-medium">PRD · Checkout v2</span>
      </div>
      <div className="space-y-1.5">
        {[
          { h: "1. Context",        w: ["w-3/4", "w-2/3"] },
          { h: "2. User stories",   w: ["w-5/6", "w-3/4", "w-1/2"] },
          { h: "3. Acceptance",     w: ["w-2/3", "w-3/4"] },
        ].map(({ h, w }) => (
          <div key={h} className="space-y-1">
            <p className="text-[10px] font-semibold" style={{ color: COLOR.ink }}>{h}</p>
            {w.map((cls, idx) => (
              <div key={`${h}-${idx}`} className={`h-1.5 ${cls} rounded`} style={{ backgroundColor: COLOR.lilac }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaskListMock() {
  // Reads as: ranked task list with priority pills.
  const tasks: Array<[string, "P0" | "P1" | "P2", string, boolean]> = [
    ["Refactor address form", "P0", COLOR.peach, true],
    ["Add Stripe Link toggle", "P0", COLOR.peach, true],
    ["Inline card-error copy",  "P1", COLOR.butter, false],
    ["A/B test ToS placement",  "P2", COLOR.mint, false],
  ];
  return (
    <ul className="space-y-1.5">
      {tasks.map(([title, pri, tint, done]) => (
        <li key={title} className="flex items-center gap-2 text-[11px]" style={{ color: COLOR.ink }}>
          <span
            className="h-3.5 w-3.5 rounded-sm flex items-center justify-center shrink-0"
            style={{ backgroundColor: done ? COLOR.ink : "transparent", border: `1px solid ${COLOR.ink}` }}
          >
            {done && <Check className="h-2.5 w-2.5" style={{ color: COLOR.paper }} />}
          </span>
          <span className={`flex-1 truncate ${done ? "line-through opacity-60" : ""}`}>{title}</span>
          <span
            className="text-[9px] font-bold px-1.5 rounded-full shrink-0"
            style={{ backgroundColor: tint, color: COLOR.ink, border: `1px solid ${COLOR.ink}` }}
          >
            {pri}
          </span>
        </li>
      ))}
    </ul>
  );
}
