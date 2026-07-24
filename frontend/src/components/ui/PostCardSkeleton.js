'use client';

export default function PostCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800/80 w-full p-4 flex flex-col space-y-4 animate-pulse select-none">
      {/* 1. Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-850 shrink-0" />
          <div className="flex flex-col space-y-2">
            <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-850 rounded" />
            <div className="h-2 w-16 bg-zinc-150 dark:bg-zinc-800 rounded" />
          </div>
        </div>
        <div className="h-8 w-8 bg-zinc-100 dark:bg-zinc-850 rounded-xl" />
      </div>

      {/* 2. Text Content Skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-850 rounded" />
        <div className="h-3 w-5/6 bg-zinc-200 dark:bg-zinc-850 rounded" />
        <div className="h-3 w-2/3 bg-zinc-150 dark:bg-zinc-800 rounded" />
      </div>

      {/* 3. Media block placeholder Skeleton */}
      <div className="w-full aspect-square rounded-2xl bg-zinc-100 dark:bg-zinc-850 border border-zinc-200/50 dark:border-zinc-800/50" />

      {/* 4. Action buttons row Skeleton */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-6">
          <div className="h-5 w-12 bg-zinc-200 dark:bg-zinc-850 rounded-lg" />
          <div className="h-5 w-12 bg-zinc-200 dark:bg-zinc-850 rounded-lg" />
          <div className="h-5 w-8 bg-zinc-150 dark:bg-zinc-800 rounded-lg" />
        </div>
        <div className="h-5 w-6 bg-zinc-200 dark:bg-zinc-850 rounded-lg" />
      </div>
    </div>
  );
}
