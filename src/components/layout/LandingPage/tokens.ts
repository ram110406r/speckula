import type { CSSProperties } from "react";

/* ── Design tokens (violet/purple scale + ink + paper) ───────────────────── */
export const COLOR = {
  // Ink + neutrals
  ink:     "#14101F",      // near-black, slight violet cast
  inkSoft: "#1F1430",      // hero / final-CTA surface
  mute:    "#5B4E73",      // muted purple-grey body text
  paper:   "#FFFFFF",      // pure white

  // Violet scale — light → deep (legacy names kept for stable refs)
  cream:   "#FAF7FF",      // warm-white with violet tint
  lilac:   "#F3E8FF",      // purple-100, pale lavender
  mint:    "#E9D5FF",      // purple-200, light violet
  butter:  "#D8B4FE",      // purple-300, medium violet
  peach:   "#C084FC",      // purple-400, soft purple

  // Brand accent
  accent:  "#7E43F5",      // Speckula vivid violet

  // Deep purple (footer)
  darkPurple: "#1A0B2E",   // deep eggplant for footer surface
} as const;

// Violet palette for the LiquidEther fluid backdrop. Module-scoped so the
// reference is stable across renders (LiquidEther's effect deps include `colors`).
export const LIQUID_COLORS = ["#4C1D95", "#7E43F5", "#E9D5FF"];

export const SERIF: CSSProperties = {
  fontFamily: 'var(--font-display), "Instrument Serif", Georgia, "Times New Roman", serif',
};

/* ── Background grid pattern (subtle, used on dark + accent sections) ───── */
export const gridBg = (color: "black" | "white"): CSSProperties => {
  const fill = color === "black" ? "%23000000" : "%23ffffff";
  return {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${fill}'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  };
};
