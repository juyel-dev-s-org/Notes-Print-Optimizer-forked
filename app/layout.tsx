import type { Metadata, Viewport } from 'next';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const iconPath = `${basePath}/icon.svg`;
const manifestPath = `${basePath}/manifest.webmanifest`;

export const metadata: Metadata = {
  title: 'PW Notes Print Optimizer',
  description: 'Mobile-first adaptive print optimizer and PDF engine for Physics Wallah and lecture class notes.',
  manifest: manifestPath,
  icons: {
    icon: iconPath,
    shortcut: iconPath,
    apple: iconPath,
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        url: `${basePath}/icon-192.png`,
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        url: `${basePath}/icon-512.png`,
      },
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
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-slate-950 text-slate-100 antialiased">
      <body className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

