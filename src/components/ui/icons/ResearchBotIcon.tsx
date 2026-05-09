import React from "react";

export function ResearchBotIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Speech bubble */}
      <rect x="32" y="4" width="22" height="16" rx="4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M36 20 L33 26 L40 20" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Antenna */}
      <line x1="18" y1="22" x2="18" y2="14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="18" cy="11" r="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="3" />

      {/* Body */}
      <rect x="8" y="26" width="36" height="28" rx="6" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />

      {/* Eyes / slots */}
      <rect x="15" y="34" width="7" height="11" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <rect x="30" y="34" width="7" height="11" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="2" />

      {/* Left arm */}
      <rect x="2" y="30" width="6" height="14" rx="3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="3" />

      {/* Right arm */}
      <rect x="44" y="30" width="6" height="14" rx="3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
