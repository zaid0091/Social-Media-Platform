import { create } from 'zustand';

const useUIStore = create((set) => ({
  isPostCreateOpen: false,
  openPostCreate: () => set({ isPostCreateOpen: true }),
  closePostCreate: () => set({ isPostCreateOpen: false }),
}));

export default useUIStore;
