'use client';

import { useEffect } from 'react';
import useAuthStore from '@/store/useAuthStore';
import api from '@/services/api';
import useNotificationsSocket from '@/hooks/useNotificationsSocket';
import useNotificationStore from '@/store/useNotificationStore';

export default function AuthInitializer({ children }) {
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const isLoading = useAuthStore((state) => state.isLoading);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);

  // Mount session refresh
  useEffect(() => {
    const isAlreadyAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAlreadyAuthenticated) {
      useAuthStore.setState({ isLoading: false });
    } else {
      refreshSession();
    }
  }, [refreshSession]);

  // Fetch initial unread count when authenticated
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    api.get('/notifications/unread-count/')
      .then((res) => {
        setUnreadCount(res.data.unread_count || 0);
      })
      .catch(() => {});
  }, [isAuthenticated, accessToken, setUnreadCount]);

  // Establish notifications WebSocket connection with exponential backoff and custom toasts
  useNotificationsSocket();

  if (isLoading) {
    return <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200" />;
  }

  return children;
}
