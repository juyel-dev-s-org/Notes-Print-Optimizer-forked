import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6 text-center">
      <h2 className="text-3xl font-bold mb-4 text-indigo-400">404 - Page Not Found</h2>
      <p className="text-slate-400 mb-6 max-w-md">
        The requested page or document route could not be found.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
