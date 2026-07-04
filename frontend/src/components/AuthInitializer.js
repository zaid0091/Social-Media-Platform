'use client';

import { useEffect } from 'react';
import useAuthStore from '@/store/useAuthStore';

export default function AuthInitializer({ children }) {
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 rounded-full border-4 border-zinc-200 dark:border-zinc-800 border-t-primary animate-spin" />
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 font-sans">Restoring session...</p>
        </div>
      </div>
    );
  }

  return children;
}
