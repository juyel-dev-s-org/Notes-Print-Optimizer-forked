'use client';

import React from 'react';

/**
 * Brand mark — mirrors public/icon.svg exactly so the in-app logo,
 * favicon and installed PWA icon are one identical artwork.
 */
export function AppLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="po-bg" x1="120" y1="80" x2="900" y2="950" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#243BFF" />
          <stop offset="45%" stopColor="#5B35FF" />
          <stop offset="100%" stopColor="#A12CFF" />
        </linearGradient>

        <linearGradient id="po-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="po-paper" x1="250" y1="250" x2="770" y2="780">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#EDEFFF" />
        </linearGradient>

        <filter id="po-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000000" floodOpacity="0.25" />
        </filter>

        <filter id="po-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" />
        </filter>

        <clipPath id="po-icon-clip">
          <rect x="72" y="72" width="880" height="880" rx="210" />
        </clipPath>
      </defs>

      {/* Rounded app-icon background */}
      <rect x="72" y="72" width="880" height="880" rx="210" fill="url(#po-bg)" />

      {/* Ambient glow */}
      <circle cx="760" cy="230" r="230" fill="#FFFFFF" opacity="0.12" filter="url(#po-glow)" />

      {/* Glass surface */}
      <rect x="72" y="72" width="880" height="880" rx="210" fill="url(#po-shine)" />

      {/* Paper sheet with folded corner */}
      <g filter="url(#po-shadow)">
        <path
          d="M300 222 H650 L770 342 V790 C770 826 741 854 705 854 H300 C264 854 236 826 236 790 V286 C236 250 264 222 300 222 Z"
          fill="url(#po-paper)"
        />
        <path d="M650 222 V314 C650 334 666 350 686 350 H770 Z" fill="#D9DEFF" />
        <path d="M650 222 L770 342 H688 C667 342 650 325 650 304 Z" fill="#FFFFFF" opacity="0.85" />
      </g>

      {/* Print lines */}
      <rect x="330" y="420" width="330" height="30" rx="15" fill="#5B35FF" opacity="0.9" />
      <rect x="330" y="490" width="260" height="30" rx="15" fill="#7A68FF" opacity="0.75" />
      <rect x="330" y="560" width="300" height="30" rx="15" fill="#9A8CFF" opacity="0.58" />

      {/* Optimization checkmark badge */}
      <g transform="translate(430 635)">
        <circle cx="82" cy="82" r="82" fill="#5B35FF" />
        <path
          d="M48 88 L70 110 L118 54"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Top glass reflection */}
      <g clipPath="url(#po-icon-clip)">
        <path d="M20 120 C220 20 520 45 1000 240 V40 H20 Z" fill="#FFFFFF" opacity="0.11" />
      </g>

      {/* Subtle border */}
      <rect
        x="73.5"
        y="73.5"
        width="877"
        height="877"
        rx="208.5"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.16"
        strokeWidth="3"
      />
    </svg>
  );
}
