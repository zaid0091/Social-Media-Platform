'use client';

export default function NotificationSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border border-zinc-150/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/50 rounded-2xl select-none animate-pulse w-full">
      <div className="flex items-center space-x-3.5 flex-1 min-w-0 mr-4">
        {/* Profile Picture Placeholder */}
        <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />

        {/* Text descriptions blocks */}
        <div className="flex flex-col space-y-2 flex-1">
          <div className="h-3 w-11/12 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-2 w-16 bg-zinc-150 dark:bg-zinc-850 rounded" />
        </div>
      </div>

      {/* Right attachment placeholder box */}
      <div className="h-9 w-9 rounded-lg bg-zinc-150 dark:bg-zinc-850 shrink-0" />
    </div>
  );
}
