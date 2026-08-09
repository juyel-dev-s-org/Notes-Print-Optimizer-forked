import type { Metadata, Viewport } from 'next';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const siteUrl = `https://juyel-dev.github.io${basePath}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'PW Notes Print Optimizer',
  description:
    'Mobile-first adaptive print optimizer and PDF engine for Physics Wallah and lecture class notes.',
  alternates: {
    canonical: `${basePath}/`,
  },
  openGraph: {
    title: 'PW Notes Print Optimizer',
    description:
      'Convert dark-background lecture slides to print-ready PDFs with optimal ink and paper usage.',
    url: `${basePath}/`,
    siteName: 'PW Notes Print Optimizer',
    type: 'website',
    images: [
      {
        url: `${basePath}/icon-512.png`,
        width: 512,
        height: 512,
        alt: 'PW Notes Print Optimizer',
      },
    ],
  },
  icons: {
    icon: [
      {
        url: `${basePath}/icon-192.png`,
        type: 'image/png',
        sizes: '192x192',
      },
      {
        url: `${basePath}/icon-512.png`,
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    shortcut: `${basePath}/icon-192.png`,
    apple: `${basePath}/icon-512.png`,
    other: [
      {
        rel: 'mask-icon',
        color: '#4f46e5',
        url: `${basePath}/icon-maskable.svg`,
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PW Optimizer',
    startupImage: [
      {
        url: `${basePath}/icon-512.png`,
        media:
          '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'msapplication-TileColor': '#0f172a',
    'msapplication-tap-highlight': 'no',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-950 text-slate-100 antialiased">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://script.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta
          httpEquiv="Referrer-Policy"
          content="strict-origin-when-cross-origin"
        />
      </head>
      <body
        className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
