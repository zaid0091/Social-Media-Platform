'use client';

import { AlertOctagon, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function FullPageError({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center select-none">
      <div className="h-20 w-20 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/5 mb-6">
        <AlertOctagon className="h-10 w-10" />
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-2">
        Something went wrong
      </h2>
      
      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-8">
        {error?.message || "An unexpected error occurred while communicating with the server. Please try refreshing or returning home."}
      </p>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full max-w-xs justify-center">
        {reset && (
          <button
            onClick={() => reset()}
            className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-150 text-white dark:text-zinc-950 text-xs font-bold rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        )}
        <Link
          href="/"
          className="flex-1 py-3 border border-zinc-250 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-2xl transition flex items-center justify-center space-x-2"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Go Home</span>
        </Link>
      </div>
    </div>
  );
}
