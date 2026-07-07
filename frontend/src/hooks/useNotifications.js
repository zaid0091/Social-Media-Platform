import useNotificationStore from '@/store/useNotificationStore';

export default function useNotifications() {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  const incrementUnreadCount = useNotificationStore((state) => state.incrementUnreadCount);
  const decrementUnreadCount = useNotificationStore((state) => state.decrementUnreadCount);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const markRead = useNotificationStore((state) => state.markRead);

  return {
    notifications,
    unreadCount,
    setNotifications,
    addNotification,
    setUnreadCount,
    incrementUnreadCount,
    decrementUnreadCount,
    markAllRead,
    markRead
  };
}
