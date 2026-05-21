---
name: visual-landing-page-designer
description: Redesign the visual aesthetics of the project's landing page against named reference sites, using a screenshot-driven feedback loop. Scope is purely visual — typography, spacing, color, hierarchy, motion, layout. Copy and messaging are treated as fixed and must not change. Use when the user asks to "redesign the homepage / landing page" or invokes /visual-landing-page-designer.
---

# Visual Landing Page Designer

You are running a focused visual redesign of the project's landing page. **Scope is visual only.** Copy text is fixed input — do not edit headings, subheadings, body copy, button labels, navigation labels, or any user-facing strings.

## Inputs you must confirm before starting

Ask the user up front (in one combined question if possible):

1. **Reference sites** — 1–4 URLs of landing pages whose visual language should inform the redesign. If user has not named any, ask. Do not guess defaults.
2. **Scope of change** — full overhaul, hero section only, or specific sections listed by the user.
3. **Constraints** — any colors, fonts, or motion treatments that must stay (brand lock-ins) or must go.

If the user already provided some of these in the invocation, only ask for what's missing.

## Project facts (verify before relying on)

- Landing page lives at [src/components/layout/LandingPage.tsx](src/components/layout/LandingPage.tsx) (single ~670-line component as of skill authoring — re-check before editing).
- Stack: Next.js 16 + React 19 + Tailwind 4 + shadcn + lucide-react icons.
- Existing motion system: custom `useInView` + `AnimateIn` IntersectionObserver fades inside `LandingPage.tsx`. No framer-motion. Prefer to extend the existing primitive over adding a library.
- Dev server: `npm run dev:web` (web only) or `npm run dev` (web + backend). Default port: 3000.
- Auth dependency: `useAuth` from `@/lib/firebase/AuthProvider`. Preserve all hooks and side effects when editing JSX.

## Workflow

### 1. Analyze references
For each reference URL, use WebFetch to study it. Extract concrete visual patterns:
- **Color** — palette, accent role, dark/light treatment, gradient usage
- **Typography** — font families implied, scale (hero / section / body / micro), weight contrast, tracking
- **Spacing rhythm** — section padding, max-widths, vertical density
- **Hero composition** — left/right vs centered, eyebrow tag, primary/secondary CTA pattern, hero visual treatment
- **Section transitions** — dividers, background shifts, motion entrances
- **Micro-details** — button radii, border treatments, shadow language, icon usage

Write a short reference brief (≤ 200 words) the user can react to before any code change.

### 2. Capture current baseline
Use the `run` skill to launch the dev server and capture the landing page at two viewports:
- Desktop: 1440×900
- Mobile: 390×844

Save screenshots to `.claude/skills/visual-landing-page-designer/screenshots/baseline-{desktop,mobile}-{timestamp}.png`. Do not commit these.

### 3. Critique current vs references
Produce a punch list — section by section — naming concrete visual gaps. Be specific:

> ❌ Hero headline uses default Tailwind font; references use a tighter display face with `-0.04em` tracking
> ❌ Section padding is `py-16` everywhere; references vary `py-24 → py-32` for breathing room
> ❌ Primary CTA uses solid `bg-primary`; references use a subtle gradient with inset highlight

Do NOT critique copy ("the headline could be punchier"). That is out of scope.

### 4. Propose a design plan
Write a short plan (≤ 300 words) listing the **specific** changes you'll make: classes to swap, new utility patterns, motion adjustments, layout restructures. **Get user approval before editing code.** This is the gate that prevents wasted rework.

### 5. Implement
- Edit `LandingPage.tsx` only, unless the plan requires a shared design token (then surface it).
- Tailwind-first. Avoid raw CSS unless Tailwind can't express it.
- Preserve every text node verbatim. If you genuinely cannot tell whether a string is "copy" or "decoration" (e.g. badge text, eyebrow tags), ask before changing.
- Preserve all hooks, refs, `useAuth`, scroll handlers, mobile menu state, and event bindings.
- Keep lucide as the icon library. Don't introduce a second icon set.
- Do NOT add new npm dependencies without explicit user approval.
- For new motion, extend the existing `AnimateIn` pattern unless the user has approved a library.

### 6. Verify
Re-screenshot at the same two viewports. Present before/after pairs (or describe them concretely if the harness can't render images inline). Note any visual regressions you can see.

### 7. Iterate
Expect 1–2 more rounds. Each round: short critique → small plan → edit → re-screenshot. Stop when the user signals done or after 3 rounds (whichever first) — if it's not landing in 3 rounds, the gap is in the brief, not the execution.

## Rules of engagement

- **Visual only.** No copy edits. No new sections. No removed sections (unless user explicitly asks).
- **Code over commentary.** Don't write design essays. Show the diff.
- **No mock screenshots.** If you cannot actually capture a screenshot, say so — do not describe a screenshot you didn't take.
- **No invented references.** If the user names a site you cannot WebFetch (e.g. it's behind auth or blocks bots), tell them and ask for an alternative.
- **One file, one PR mindset.** Keep changes contained to the landing page and any tokens it forces you to touch.

## Done criteria

- Landing page renders without errors at desktop and mobile viewports.
- All original copy strings present and unchanged (grep before/after to verify).
- All original interactive behaviors work (nav scroll, mobile menu, auth CTA, scroll-triggered fades).
- User has seen final screenshots and approved.
