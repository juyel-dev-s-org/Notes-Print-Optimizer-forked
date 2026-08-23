import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { SITE_URL, withBase } from '@/lib/site';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const DESCRIPTION =
  'Every PDF, print-perfect â€” merge, whiten dark notes, enhance light scans & build smart N-up layouts. 100% offline, on-device.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Print Optimizer',
    template: '%s Â· Print Optimizer',
  },
  description: DESCRIPTION,
  alternates: {
    canonical: withBase('/'),
  },
  openGraph: {
    title: 'Print Optimizer',
    description: DESCRIPTION,
    url: withBase('/'),
    siteName: 'Print Optimizer',
    type: 'website',
    images: [
      {
        url: `${withBase('/icon-512-v2.png')}`,
        width: 512,
        height: 512,
        alt: 'Print Optimizer',
      },
    ],
  },
  icons: {
    icon: [
      {
        url: `${withBase('/icon-192-v2.png')}`,
        type: 'image/png',
        sizes: '192x192',
      },
      {
        url: `${withBase('/icon-512-v2.png')}`,
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    shortcut: `${withBase('/icon-192-v2.png')}`,
    apple: `${withBase('/icon-512-v2.png')}`,
    other: [
      {
        rel: 'mask-icon',
        color: '#243BFF',
        url: `${withBase('/icon-maskable-v2.svg')}`,
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Print Optimizer',
    startupImage: [
      {
        url: `${withBase('/icon-512-v2.png')}`,
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
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('po:theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='light'?'#f4f6fb':'#020617')}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full bg-bg text-ink antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://script.google.com https://script.googleusercontent.com; object-src 'none'; base-uri 'self'; form-action 'self'"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta
          httpEquiv="Referrer-Policy"
          content="strict-origin-when-cross-origin"
        />
      </head>
      <body
        className="min-h-full flex flex-col font-sans bg-bg text-ink selection:bg-primary selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}