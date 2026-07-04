'use client';

import { Plus } from 'lucide-react';
import useUIStore from '@/store/useUIStore';

export default function NewPostButton() {
  const openPostCreate = useUIStore((state) => state.openPostCreate);

  return (
    <button
      onClick={openPostCreate}
      className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-primary to-secondary hover:opacity-95 text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary cursor-pointer text-sm md:text-base select-none"
      aria-label="Create New Post"
    >
      <Plus className="h-5 w-5" />
      <span className="hidden xl:inline">Post</span>
    </button>
  );
}
