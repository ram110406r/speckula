"use client";

import React from "react";

/**
 * Responsive layout primitives for consistent mobile-first design across Speckula
 */

// ─── ResponsiveContainer ────────────────────────────────────────────────────
/** Wrapper with max-width and responsive padding. Use at top-level of views. */
export function ResponsiveContainer({
  children,
  className = "",
  maxWidth = "max-w-7xl",
}: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  return (
    <div className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${maxWidth} ${className}`}>
      {children}
    </div>
  );
}

// ─── ResponsiveGrid ─────────────────────────────────────────────────────────
/** Adaptive grid that stacks on mobile. */
export function ResponsiveGrid({
  children,
  columns = "lg:grid-cols-3",
  className = "",
  gap = "gap-4 sm:gap-5 lg:gap-6",
}: {
  children: React.ReactNode;
  columns?: string;
  className?: string;
  gap?: string;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${columns} ${gap} ${className}`}>
      {children}
    </div>
  );
}

// ─── ResponsiveStack ────────────────────────────────────────────────────────
/** Flexbox stack that changes direction responsively. */
export function ResponsiveStack({
  children,
  direction = "flex-col sm:flex-row",
  align = "items-stretch sm:items-center",
  className = "",
  gap = "gap-3 sm:gap-4 lg:gap-6",
}: {
  children: React.ReactNode;
  direction?: string;
  align?: string;
  className?: string;
  gap?: string;
}) {
  return (
    <div className={`flex ${direction} ${align} ${gap} ${className}`}>
      {children}
    </div>
  );
}

// ─── ResponsiveCard ─────────────────────────────────────────────────────────
/** Card with responsive padding and hover effects. */
export function ResponsiveCard({
  children,
  className = "",
  hoverable = false,
}: {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`
        bg-card border border-border/70 rounded-lg p-4 sm:p-5 lg:p-6
        transition-all duration-300
        ${hoverable ? "hover:border-border hover:shadow-md hover:-translate-y-1" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ─── ResponsiveSection ──────────────────────────────────────────────────────
/** Section wrapper with responsive padding and spacing. */
export function ResponsiveSection({
  children,
  className = "",
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className={`py-8 sm:py-12 lg:py-16 ${className}`}>
      <ResponsiveContainer>
        {(title || description) && (
          <div className="mb-8 sm:mb-10 lg:mb-12">
            {title && (
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 sm:mb-3">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// ─── ResponsiveTable ────────────────────────────────────────────────────────
/** Responsive table that becomes a list on mobile. */
export function ResponsiveTable({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  );
}

// ─── ResponsiveHeader ────────────────────────────────────────────────────────
/** Header with responsive typography and spacing. */
export function ResponsiveHeader({
  children,
  level = "h2",
  className = "",
}: {
  children: React.ReactNode;
  level?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  className?: string;
}) {
  const Component = level;
  const sizeMap = {
    h1: "text-3xl sm:text-4xl lg:text-5xl",
    h2: "text-2xl sm:text-3xl lg:text-4xl",
    h3: "text-xl sm:text-2xl lg:text-3xl",
    h4: "text-lg sm:text-xl lg:text-2xl",
    h5: "text-base sm:text-lg lg:text-xl",
    h6: "text-sm sm:text-base lg:text-lg",
  };

  return (
    <Component className={`font-semibold text-foreground ${sizeMap[level]} ${className}`}>
      {children}
    </Component>
  );
}

// ─── ResponsiveBadge ────────────────────────────────────────────────────────
/** Badge with responsive padding and text size. */
export function ResponsiveBadge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const variants = {
    default: "bg-primary/10 text-primary border border-primary/20",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5
        rounded-full text-xs sm:text-sm font-medium
        ${variants[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}

// ─── MobileOnly ─────────────────────────────────────────────────────────────
/** Render only on mobile devices. */
export function MobileOnly({ children }: { children: React.ReactNode }) {
  return <div className="block md:hidden">{children}</div>;
}

// ─── DesktopOnly ────────────────────────────────────────────────────────────
/** Render only on desktop devices. */
export function DesktopOnly({ children }: { children: React.ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}

// ─── ResponsiveButtonGroup ──────────────────────────────────────────────────
/** Button group that stacks on mobile. */
export function ResponsiveButtonGroup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col sm:flex-row gap-2 sm:gap-3 ${className}`}>
      {children}
    </div>
  );
}

// ─── ResponsivePageWrapper ──────────────────────────────────────────────────
/** Main wrapper for full-page views with proper height handling. */
export function ResponsivePageWrapper({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-h-full w-full min-w-0 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// ─── ResponsiveScroll ────────────────────────────────────────────────────────
/** Scrollable container with proper overflow handling. */
export function ResponsiveScroll({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-y-auto overflow-x-hidden h-full w-full ${className}`}>
      {children}
    </div>
  );
}

// ─── ResponsiveMetric ────────────────────────────────────────────────────────
/** Metric/stat card with responsive sizing. */
export function ResponsiveMetric({
  label,
  value,
  icon,
  className = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <ResponsiveCard hoverable className={className}>
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        {icon && (
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-lg sm:text-2xl font-bold text-foreground mt-1">{value}</p>
        </div>
      </div>
    </ResponsiveCard>
  );
}

// ─── ResponsiveListItem ─────────────────────────────────────────────────────
/** List item with responsive padding and touch targets. */
export function ResponsiveListItem({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        px-4 sm:px-5 lg:px-6 py-3 sm:py-4
        border-b border-border/30 last:border-b-0
        hover:bg-muted/40 transition-colors
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ─── ResponsiveTabs ────────────────────────────────────────────────────────
/** Tab group that scrolls horizontally on mobile. */
export function ResponsiveTabs({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto border-b border-border/70 ${className}`}>
      <div className="flex gap-1 px-4 sm:px-6 lg:px-8 min-w-min">
        {children}
      </div>
    </div>
  );
}

// ─── ResponsiveTab ──────────────────────────────────────────────────────────
/** Individual tab with responsive padding. */
export function ResponsiveTab({
  label,
  active,
  onClick,
  className = "",
}: {
  label: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap
        text-xs sm:text-sm font-medium
        border-b-2 transition-all
        ${
          active
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }
        ${className}
      `}
    >
      {label}
    </button>
  );
}
