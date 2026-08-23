import Link from 'next/link';

/**
 * 404 — real routes exist now (/tools/<slug>/), so the legacy GitHub Pages
 * `?/`-query redirect hack is gone. Unknown URLs simply get this page.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-center text-ink">
      <h2 className="mb-4 text-3xl font-bold text-primary-soft">404 - Page Not Found</h2>
      <p className="mb-6 max-w-md text-ink-muted">
        The requested page or document route could not be found.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary-strong px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary"
      >
        Return Home
      </Link>
    </div>
  );
}
