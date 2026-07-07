import useUIStore from '@/store/useUIStore';

export default function useUI() {
  const isPostCreateOpen = useUIStore((state) => state.isPostCreateOpen);
  const activeTab = useUIStore((state) => state.activeTab);
  const theme = useUIStore((state) => state.theme);

  const openPostCreate = useUIStore((state) => state.openPostCreate);
  const closePostCreate = useUIStore((state) => state.closePostCreate);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const setTheme = useUIStore((state) => state.setTheme);

  return {
    isPostCreateOpen,
    activeTab,
    theme,
    openPostCreate,
    closePostCreate,
    setActiveTab,
    setTheme
  };
}
