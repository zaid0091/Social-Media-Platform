'use client';

import Link from 'next/link';
import { Compass, Home, MessageSquare, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 text-center select-none">
      {/* 404 Header Art */}
      <div className="relative mb-6">
        <h1 className="text-8xl sm:text-9xl font-black text-zinc-200 dark:text-zinc-850 tracking-widest select-none">
          404
        </h1>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-primary/20 rotate-6">
          Page Not Found
        </div>
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-2">
        Lost in space?
      </h2>
      
      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-10">
        The link you followed may be broken, or the page may have been removed. Let's get you back on track.
      </p>

      {/* Suggested Sections Nav */}
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xl shadow-zinc-200/40 dark:shadow-none space-y-3">
        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block text-left px-1">
          Suggestions
        </span>

        <div className="grid grid-cols-1 gap-2">
          <Link
            href="/"
            className="flex items-center space-x-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl transition border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800"
          >
            <div className="h-8 w-8 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Home className="h-4.5 w-4.5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Home Feed</div>
              <div className="text-[10px] text-zinc-450">Check latest posts & stories</div>
            </div>
          </Link>

          <Link
            href="/explore"
            className="flex items-center space-x-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl transition border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800"
          >
            <div className="h-8 w-8 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
              <Compass className="h-4.5 w-4.5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Explore</div>
              <div className="text-[10px] text-zinc-450">Find trending topics & users</div>
            </div>
          </Link>

          <Link
            href="/messages"
            className="flex items-center space-x-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl transition border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800"
          >
            <div className="h-8 w-8 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
              <MessageSquare className="h-4.5 w-4.5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Direct Messages</div>
              <div className="text-[10px] text-zinc-450">Chat with friends</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
