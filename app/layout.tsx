import type { Metadata, Viewport } from 'next';
import './globals.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const iconPath = `${basePath}/icon.svg`;

export const metadata: Metadata = {
  title: 'PW Notes Print Optimizer',
  description: 'Mobile-first adaptive print optimizer and PDF engine for Physics Wallah and lecture class notes.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: iconPath,
    shortcut: iconPath,
    apple: iconPath,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PW Optimizer',
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

