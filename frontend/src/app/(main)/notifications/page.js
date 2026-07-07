'use client';

import { useEffect, useMemo } from 'react';
import { Bell, CheckSquare } from 'lucide-react';
import api from '@/services/api';
import useNotificationStore from '@/store/useNotificationStore';
import useNotificationsQuery from '@/hooks/useNotificationsQuery';
import NotificationItem from '@/components/notifications/NotificationItem';
import FlatList from '@/components/ui/FlatList';

export default function NotificationsPage() {
  const { 
    notifications, 
    unreadCount, 
    setNotifications, 
    markRead, 
    markAllRead 
  } = useNotificationStore();

  // Fetch paginated notifications list from REST API using React Query
  const { 
    data, 
    error, 
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useNotificationsQuery({
    refetchInterval: 20000
  });

  const notificationsList = useMemo(() => {
    return data?.pages.flatMap(page => page.results) || [];
  }, [data]);

  const notificationsIdsJson = JSON.stringify(notificationsList.map(n => n.id));

  // Synchronize REST fetched notifications to Zustand store
  useEffect(() => {
    if (notificationsList.length > 0) {
      setNotifications(notificationsList);
    }
  }, [notificationsIdsJson, setNotifications]);

  const handleMarkRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read/`);
      markRead(notificationId);
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await api.post('/notifications/mark-all-read/');
      markAllRead();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

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
        
        {unreadCount > 0 && (
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
      <div className="pt-6 pb-20">
        <FlatList
          data={notificationsList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem 
              key={item.id} 
              notification={item} 
              onMarkRead={handleMarkRead}
            />
          )}
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isLoading={isLoading}
          isError={!!error}
          error={error}
          refetch={refetch}
          className="space-y-3"
          ListEmptyComponent={
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 w-full">
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
          }
        />
      </div>
    </div>
  );
}
