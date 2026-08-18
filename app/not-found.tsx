'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * GitHub Pages SPA redirect: Next's export overwrites `public/404.html` with
 * this generated page, so the classic static-host redirect script must live
 * here. It converts the deep link path into the `?/` query-string route the
 * app reads on boot, e.g. `/Notes-Print-Optimizer/settings` -> `/?/settings`.
 */
export default function NotFound() {
  useEffect(() => {
    const pathSegmentsToKeep = 1; // repo name segment
    const l = window.location;
    const redirect =
      l.protocol +
      '//' +
      l.hostname +
      (l.port ? ':' + l.port : '') +
      l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') +
      '/?/' +
      l.pathname
        .slice(1)
        .split('/')
        .slice(pathSegmentsToKeep)
        .join('/')
        .replace(/&/g, '~and~') +
      (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
      l.hash;
    window.location.replace(redirect);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-ink p-6 text-center">
      <h2 className="text-3xl font-bold mb-4 text-primary-soft">404 - Page Not Found</h2>
      <p className="text-ink-muted mb-6 max-w-md">
        The requested page or document route could not be found.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg bg-primary-strong hover:bg-primary text-white font-medium transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}