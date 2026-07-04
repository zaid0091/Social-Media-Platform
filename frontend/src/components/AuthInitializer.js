'use client';

import { useEffect } from 'react';
import useAuthStore from '@/store/useAuthStore';
import api from '@/services/api';

export default function AuthInitializer({ children }) {
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const isLoading = useAuthStore((state) => state.isLoading);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUnreadNotificationCount = useAuthStore((state) => state.setUnreadNotificationCount);
  const incrementUnreadNotificationCount = useAuthStore((state) => state.incrementUnreadNotificationCount);

  // Mount session refresh
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Fetch initial unread count and open WebSocket when authenticated
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // 1. Fetch initial unread count from backend
    api.get('/notifications/unread-count/')
      .then((res) => {
        setUnreadNotificationCount(res.data.unread_count || 0);
      })
      .catch(() => {});

    // 2. Open notification channels WebSocket
    const wsUrl = `ws://127.0.0.1:8000/ws/notifications/?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          incrementUnreadNotificationCount();
          // Dispatch custom event for real-time notifications page prepend updates
          const customEvent = new CustomEvent('new-notification-received', { detail: data.notification });
          window.dispatchEvent(customEvent);
        }
      } catch (err) {}
    };

    return () => {
      if (ws) ws.close();
    };
  }, [isAuthenticated, accessToken, setUnreadNotificationCount, incrementUnreadNotificationCount]);

  if (isLoading) {
    return <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200" />;
  }

  return children;
}
