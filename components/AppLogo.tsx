'use client';

import React from 'react';

export function AppLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="pw_bg" x1="24" y1="20" x2="232" y2="236">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="55%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0B1220" />
        </linearGradient>

        <linearGradient id="pw_glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E5E7EB" />
        </linearGradient>

        <linearGradient id="pw_gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF7C2" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        <radialGradient id="pw_glow">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity=".45" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
        </radialGradient>

        <filter id="pw_shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="14"
            floodColor="#020617"
            floodOpacity=".45"
          />
        </filter>
      </defs>

      {/* Background */}
      <rect x="16" y="16" width="224" height="224" rx="56" fill="url(#pw_bg)" />

      {/* Ambient Glow */}
      <circle cx="128" cy="128" r="90" fill="url(#pw_glow)" />

      {/* Top Shine */}
      <path
        d="M32 48 Q128 -8 224 48 L224 74 Q128 32 32 74Z"
        fill="#fff"
        opacity=".09"
      />

      {/* Premium Printer */}
      <g filter="url(#pw_shadow)">
        {/* Paper */}
        <rect x="80" y="44" width="96" height="54" rx="12" fill="url(#pw_glass)" />

        {/* Printer */}
        <rect x="56" y="82" width="144" height="102" rx="24" fill="#111827" />

        {/* Top Panel */}
        <rect x="72" y="96" width="112" height="16" rx="8" fill="#374151" />

        {/* Output */}
        <rect x="76" y="140" width="104" height="54" rx="10" fill="url(#pw_glass)" />

        {/* Print */}
        <rect x="94" y="154" width="68" height="5" rx="3" fill="#94A3B8" />
        <rect x="94" y="166" width="56" height="5" rx="3" fill="#CBD5E1" />

        {/* Status */}
        <circle cx="176" cy="104" r="5" fill="#22C55E" />
      </g>

      {/* Optimization Orbit */}
      <circle
        cx="128"
        cy="128"
        r="84"
        stroke="#FFFFFF"
        strokeOpacity=".08"
        strokeWidth="3"
      />
      <circle
        cx="128"
        cy="128"
        r="64"
        stroke="#FFFFFF"
        strokeOpacity=".05"
        strokeWidth="2"
      />

      {/* Orbit Accent */}
      <circle cx="188" cy="78" r="6" fill="#60A5FA" />

      {/* Premium Spark */}
      <g transform="translate(174 38)">
        <path
          fill="url(#pw_gold)"
          d="M18 0 L22 10 L32 14 L22 18 L18 28 L14 18 L4 14 L14 10 Z"
        />
        <circle cx="3" cy="5" r="2" fill="#fff" />
        <circle cx="31" cy="29" r="2" fill="#fff" />
      </g>
    </svg>
  );
}
