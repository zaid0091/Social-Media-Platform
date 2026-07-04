'use client';

import { Plus } from 'lucide-react';

export default function CreatePostFAB() {
  const handleOpenModal = () => {
    alert('Create post modal click trigger placeholder');
  };

  return (
    <button
      onClick={handleOpenModal}
      className="md:hidden fixed bottom-20 right-5 h-14 w-14 rounded-full bg-gradient-to-r from-primary to-secondary hover:opacity-95 text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary cursor-pointer"
      aria-label="Create New Post"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
