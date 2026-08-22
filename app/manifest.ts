import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${basePath}/`,
    name: 'Print Optimizer',
    short_name: 'Print Optimizer',
    description:
      'Every PDF, print-perfect — merge, whiten dark notes, enhance light scans & build smart N-up layouts. 100% offline, on-device.',
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    background_color: '#020617',
    /* Static by PWA platform design — brand indigo reads as intentional on
       both light and dark headers (runtime toggle only drives meta theme-color). */
    theme_color: '#4338ca',
    orientation: 'portrait-primary',
    categories: ['education', 'productivity', 'utilities'],
    prefer_related_applications: false,
    icons: [
      {
        src: `${basePath}/icon-192-v2.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icon-512-v2.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icon-maskable-v2.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
