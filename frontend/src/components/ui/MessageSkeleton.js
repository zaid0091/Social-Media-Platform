'use client';

export default function MessageSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 select-none animate-pulse w-full">
      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
        {/* Avatar Placeholder */}
        <div className="h-11 w-11 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />

        {/* Text rows placeholders */}
        <div className="flex flex-col space-y-2 flex-1 min-w-0">
          <div className="h-3.5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-5/6 bg-zinc-150 dark:bg-zinc-850 rounded" />
        </div>
      </div>
      
      {/* Time status mark placeholder */}
      <div className="h-3.5 w-8 bg-zinc-150 dark:bg-zinc-850 rounded shrink-0 ml-4" />
    </div>
  );
}
