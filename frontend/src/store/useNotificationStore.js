import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useNotificationStore = create(
  devtools(
    (set) => ({
      notifications: [],
      unreadCount: 0,
      setNotifications: (notifications) => set({ notifications }),
      addNotification: (notification) => set((state) => {
        // Avoid duplicate insertions
        if (state.notifications.some((n) => n.id === notification.id)) {
          return {};
        }
        return {
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1
        };
      }),
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
      decrementUnreadCount: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
      markAllRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0
      })),
      markRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) => n.id === id ? { ...n, is_read: true } : n),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }))
    }),
    { name: 'NotificationStore' }
  )
);

export default useNotificationStore;
