'use client';

export default function ProfileSkeleton() {
  return (
    <div className="flex flex-col min-h-screen w-full animate-pulse select-none bg-white dark:bg-zinc-900">
      {/* 1. Header / Navbar Navigation */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </header>

      {/* 2. Cover Photo Section */}
      <div className="h-32 sm:h-48 w-full bg-zinc-150 dark:bg-zinc-850" />

      {/* 3. Profile Information Panel */}
      <div className="px-6 pb-6 relative flex flex-col space-y-4">
        {/* Profile Avatar and Actions row */}
        <div className="flex justify-between items-end -mt-12 sm:-mt-16">
          <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-800 shrink-0 shadow-md" />
          <div className="h-9 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        </div>

        {/* User Details */}
        <div className="space-y-2 mt-2">
          <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-32 bg-zinc-150 dark:bg-zinc-850 rounded" />
        </div>

        {/* Stats Row */}
        <div className="flex space-x-6 py-2 border-y border-zinc-100 dark:border-zinc-800/80 mt-2">
          <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>

        {/* Bio text */}
        <div className="space-y-1.5 pt-2">
          <div className="h-3 w-full bg-zinc-150 dark:bg-zinc-850 rounded" />
          <div className="h-3 w-4/5 bg-zinc-150 dark:bg-zinc-850 rounded" />
        </div>
      </div>

      {/* 4. Tabs Row */}
      <div className="flex border-b border-zinc-150 dark:border-zinc-800/80">
        <div className="flex-1 py-3 flex justify-center">
          <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
        <div className="flex-1 py-3 flex justify-center">
          <div className="h-4 w-12 bg-zinc-150 dark:bg-zinc-850 rounded" />
        </div>
      </div>

      {/* 5. Posts Grid placeholders */}
      <div className="grid grid-cols-3 gap-1 p-1 flex-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square bg-zinc-100 dark:bg-zinc-850 border border-zinc-200/20 dark:border-zinc-800/20" />
        ))}
      </div>
    </div>
  );
}
