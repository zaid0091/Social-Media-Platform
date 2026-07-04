'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Bell, CheckSquare, Trash2, ArrowRightLeft } from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import NotificationItem from '@/components/notifications/NotificationItem';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function NotificationsPage() {
  const { unreadNotificationCount, setUnreadNotificationCount } = useAuthStore();
  const [page, setPage] = useState(1);

  // Fetch paginated notifications list (poll every 20s or revalidate on focus)
  const { data, error, mutate, isLoading } = useSWR(
    `/notifications/?page=${page}`,
    fetcher,
    { refreshInterval: 20000 }
  );

  const notifications = data?.results || [];
  const hasNext = !!data?.next;
  const hasPrev = !!data?.previous;

  // Group notifications into time buckets
  const getGroupedNotifications = () => {
    const today = [];
    const thisWeek = [];
    const earlier = [];

    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    notifications.forEach((item) => {
      const created = new Date(item.created_at);
      const diffMs = now - created;

      if (diffMs < oneDayMs) {
        today.push(item);
      } else if (diffMs < sevenDaysMs) {
        thisWeek.push(item);
      } else {
        earlier.push(item);
      }
    });

    return { today, thisWeek, earlier };
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read/`);
      // Update local SWR cache immediately
      mutate(
        {
          ...data,
          results: notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ),
        },
        false
      );
      // Decrement the global unread count
      setUnreadNotificationCount(Math.max(0, unreadNotificationCount - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadNotificationCount === 0) return;
    try {
      await api.post('/notifications/mark-all-read/');
      mutate(
        {
          ...data,
          results: notifications.map((n) => ({ ...n, is_read: true })),
        },
        false
      );
      setUnreadNotificationCount(0);
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const { today, thisWeek, earlier } = getGroupedNotifications();

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 md:px-6">
      
      {/* Header Panel */}
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5 shrink-0">
        <div className="flex items-center space-x-2.5">
          <Bell className="h-6 w-6 text-zinc-900 dark:text-zinc-50" />
          <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50">
            Notifications
          </h1>
        </div>
        
        {unreadNotificationCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-250 border border-zinc-250/20 dark:border-zinc-850 rounded-xl text-xs font-black select-none cursor-pointer transition"
          >
            <CheckSquare className="h-4 w-4 text-zinc-650 dark:text-zinc-400" />
            <span>Mark all read</span>
          </button>
        )}
      </header>

      {/* Main Lists Section */}
      <div className="pt-6 space-y-7 pb-20">
        {isLoading && page === 1 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
            <p className="text-xs text-zinc-500 font-semibold">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-xs text-zinc-500 font-semibold">
            Failed to load notifications history.
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500">
              <Bell className="h-7 w-7 stroke-[1.5]" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">No Notifications</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                When people like, comment on, or react to your posts, you will see those activities here.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Today Group */}
            {today.length > 0 && (
              <div className="space-y-3 text-left">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">Today</h2>
                <div className="space-y-2">
                  {today.map((item) => (
                    <NotificationItem 
                      key={item.id} 
                      notification={item} 
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* This Week Group */}
            {thisWeek.length > 0 && (
              <div className="space-y-3 text-left">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">This Week</h2>
                <div className="space-y-2">
                  {thisWeek.map((item) => (
                    <NotificationItem 
                      key={item.id} 
                      notification={item} 
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Earlier Group */}
            {earlier.length > 0 && (
              <div className="space-y-3 text-left">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">Earlier</h2>
                <div className="space-y-2">
                  {earlier.map((item) => (
                    <NotificationItem 
                      key={item.id} 
                      notification={item} 
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {(hasPrev || hasNext) && (
              <footer className="flex items-center justify-between pt-4 border-t border-zinc-150 dark:border-zinc-850">
                <button
                  disabled={!hasPrev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent rounded-xl text-xs font-bold transition select-none cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-xs font-black text-zinc-400">Page {page}</span>
                <button
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent rounded-xl text-xs font-bold transition select-none cursor-pointer"
                >
                  Next
                </button>
              </footer>
            )}
          </>
        )}
      </div>
    </div>
  );
}
