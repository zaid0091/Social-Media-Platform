import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useUIStore = create(
  devtools(
    (set) => ({
      isPostCreateOpen: false,
      activeTab: 'home',
      theme: 'light',

      openPostCreate: () => set({ isPostCreateOpen: true }),
      closePostCreate: () => set({ isPostCreateOpen: false }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'UIStore' }
  )
);

export default useUIStore;
