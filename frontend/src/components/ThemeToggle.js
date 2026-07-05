'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration layout mismatch by rendering empty frame until client mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 animate-pulse shrink-0 ${className}`} />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-95 cursor-pointer shrink-0 ${className}`}
      aria-label="Toggle dark mode"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className="h-4.5 w-4.5 text-yellow-500 fill-yellow-500 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="h-4.5 w-4.5 text-indigo-600 transition-transform duration-300 rotate-0 hover:-rotate-12" />
      )}
    </button>
  );
}
