"use client";

import React, { useRef, useState, useEffect } from "react";

/* ── Device-capability hook — disables heavy motion on touch / reduced-motion ─
 * Returns `true` only on pointer-fine devices that haven't opted out of motion.
 * Used to decide whether to mount the WebGL fluid sim in the hero.  */
export function useShouldRenderHeavyMotion() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const reduced  = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse   = window.matchMedia("(pointer: coarse)");

    const evaluate = () => setShouldRender(!reduced.matches && !coarse.matches);
    evaluate();

    reduced.addEventListener("change", evaluate);
    coarse .addEventListener("change", evaluate);
    return () => {
      reduced.removeEventListener("change", evaluate);
      coarse .removeEventListener("change", evaluate);
    };
  }, []);

  return shouldRender;
}

/* ── Scroll-triggered animation hook ─────────────────────────────────────────
 * All AnimateIn instances share a single IntersectionObserver rather than each
 * creating its own (~30 on this page). A callback registry maps observed nodes
 * to their "now visible" setter; each node is unobserved after it first reveals
 * (one-shot animation). */
const inViewCallbacks = new WeakMap<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          inViewCallbacks.get(entry.target)?.();
          sharedObserver?.unobserve(entry.target);
          inViewCallbacks.delete(entry.target);
        }
      },
      { threshold: 0.12 }
    );
  }
  return sharedObserver;
}

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = getSharedObserver();
    // No IntersectionObserver (SSR / unsupported) → reveal immediately.
    if (!observer) { setInView(true); return; }
    inViewCallbacks.set(el, () => setInView(true));
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      inViewCallbacks.delete(el);
    };
  }, []);
  return { ref, inView };
}

type AnimateVariant = "fade-up" | "fade" | "scale";

export function AnimateIn({
  children, delay = 0, className = "", variant = "fade-up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  variant?: AnimateVariant;
}) {
  const { ref, inView } = useInView();

  const hiddenClass =
    variant === "fade" ? "opacity-0"
    : variant === "scale" ? "opacity-0 scale-[0.985]"
    : "opacity-0 translate-y-4";

  const shownClass =
    variant === "fade" ? "opacity-100"
    : variant === "scale" ? "opacity-100 scale-100"
    : "opacity-100 translate-y-0";

  return (
    <div
      ref={ref}
      // data-animate lets a <noscript> style override force these visible when
      // JS is disabled (otherwise IntersectionObserver never fires and content
      // stays opacity-0 forever — blank page for no-JS users and slower indexing).
      data-animate
      className={`duration-700 ease-out ${inView ? shownClass : hiddenClass} ${className}`}
      // Restrict to the properties we actually animate. transition-all forces
      // the compositor to listen for every animatable property change, which
      // becomes expensive when dozens of AnimateIn instances live on the page.
      style={{
        transitionProperty: "opacity, transform",
        transitionDelay: `${delay}ms`,
        willChange: inView ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
