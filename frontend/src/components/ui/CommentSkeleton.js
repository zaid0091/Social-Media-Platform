'use client';

export default function CommentSkeleton() {
  return (
    <div className="w-full flex space-x-3 p-3 select-none animate-pulse">
      {/* Avatar circle */}
      <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />

      {/* Comment Details */}
      <div className="flex-1 flex flex-col space-y-2 mt-0.5">
        <div className="flex items-center space-x-2">
          <div className="h-3.5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-2.5 w-12 bg-zinc-150 dark:bg-zinc-850 rounded" />
        </div>
        <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-3 w-5/6 bg-zinc-150 dark:bg-zinc-850 rounded" />

        <div className="flex space-x-3 pt-1">
          <div className="h-3 w-8 bg-zinc-150 dark:bg-zinc-850 rounded" />
          <div className="h-3 w-8 bg-zinc-150 dark:bg-zinc-850 rounded" />
        </div>
      </div>
    </div>
  );
}
