'use client';

export default function StoryBarSkeleton() {
  return (
    <div className="w-full border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/20 dark:bg-zinc-900/20 py-4 px-4 overflow-hidden select-none animate-pulse">
      <div className="flex space-x-4 overflow-x-auto scrollbar-none">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex flex-col items-center space-y-2 shrink-0">
            <div className="h-14 w-14 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-transparent p-[2px]" />
            <div className="h-2 w-10 bg-zinc-150 dark:bg-zinc-850 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
