'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export default function InlineError({ message, refetch }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 border border-red-100 dark:border-red-950/40 bg-red-50/30 dark:bg-red-950/5 rounded-2xl space-y-3 w-full text-center">
      <div className="flex items-center space-x-2 text-rose-500 font-bold text-xs select-none">
        <AlertCircle className="h-4.5 w-4.5 shrink-0 animate-bounce" />
        <span>{message || 'Failed to load details.'}</span>
      </div>
      
      {refetch && (
        <button
          onClick={() => refetch()}
          className="px-3.5 py-1.5 bg-red-500 hover:bg-red-650 text-white rounded-xl text-[10px] font-black tracking-wider uppercase transition flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-red-500/10"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
