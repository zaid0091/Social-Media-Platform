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
    return <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200" />;
  }

  return children;
}
