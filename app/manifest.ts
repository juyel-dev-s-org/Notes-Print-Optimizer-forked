import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PW Notes Print Optimizer',
    short_name: 'PW Optimizer',
    description: 'Mobile-first print optimizer and adaptive layout engine for PW lecture notes',
    start_url: `${basePath}/`,
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    orientation: 'portrait-primary',
    icons: [
      {
        src: `${basePath}/icon.svg`,
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
