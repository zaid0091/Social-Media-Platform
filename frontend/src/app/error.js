'use client';

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 text-center select-none">
      <div className="h-20 w-20 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/5 mb-6 animate-pulse">
        <AlertTriangle className="h-10 w-10" />
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-2">
        Server Error (500)
      </h2>
      
      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-10">
        The server encountered an error processing your request. Please try again or go back home.
      </p>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full max-w-xs justify-center">
        <button
          onClick={() => reset()}
          className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-150 text-white dark:text-zinc-950 text-xs font-bold rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Request</span>
        </button>
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
