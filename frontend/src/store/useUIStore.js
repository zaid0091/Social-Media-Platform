import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useUIStore = create(
  devtools(
    (set) => ({
      isPostCreateOpen: false,
      activeTab: 'home',
      theme: 'light',
      toasts: [],

      openPostCreate: () => set({ isPostCreateOpen: true }),
      closePostCreate: () => set({ isPostCreateOpen: false }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setTheme: (theme) => set({ theme }),

      addToast: (message, type = 'info') => set((state) => {
        const id = Date.now();
        // Remove automatically after 3 seconds
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 3000);
        return { toasts: [...state.toasts, { id, message, type }] };
      }),
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
    }),
    { name: 'UIStore' }
  )
);

export default useUIStore;
