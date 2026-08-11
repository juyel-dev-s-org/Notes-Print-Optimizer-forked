import dynamic from 'next/dynamic';

const AppShell = dynamic(() => import('@/components/AppShell'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 app-shell-bg text-slate-100 font-sans flex flex-col">
      <header className="border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto w-full max-w-5xl lg:max-w-6xl px-3 py-3 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              PW
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-100">
              PW Notes Print Optimizer
            </h1>
          </div>
          <div className="h-8 w-24 rounded-md bg-slate-800/50 animate-pulse" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl lg:max-w-6xl flex-1 px-3 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading application...</p>
        </div>
      </main>
      <footer className="border-t border-slate-800/60 px-4 py-6 text-center text-[11px] text-slate-400">
        <p className="font-medium text-slate-400">&copy; 2026 Juyel Hossain</p>
      </footer>
    </div>
  ),
});

export default function HomePage() {
  return <AppShell />;
}
