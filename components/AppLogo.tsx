'use client';

import React from 'react';
import Image from 'next/image';

/**
 * Brand mark — the same artwork as the PWA icon (public/icon-master.png
 * pipeline), so the in-app logo, favicon and installed app icon are one
 * identical piece of art. Rendered from the 192px raster; basePath is
 * applied automatically by next/image.
 */
export function AppLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <Image
      src="/icon-192-v2.png"
      alt=""
      width={192}
      height={192}
      className={`${className} object-contain`}
      aria-hidden="true"
      priority
    />
  );
}
