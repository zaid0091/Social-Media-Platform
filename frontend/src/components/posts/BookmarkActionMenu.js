'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Folder, FolderPlus, Check, Bookmark, Plus, Loader2 } from 'lucide-react';
import api from '@/services/api';
import CollectionCreateModal from './CollectionCreateModal';

export default function BookmarkActionMenu({ post, onClose, onBookmarkToggle, onRemoveConfirm }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // stores collection ID of current operation

  // Fetch collections
  const { data: collections, mutate } = useSWR('/posts/collections/', () =>
    api.get('/posts/collections/').then((res) => res.data)
  );

  const handleCollectionClick = async (e, collection) => {
    e.stopPropagation();
    const isAlreadyIn = collection.post_ids?.includes(post.id);
    setActionLoading(collection.id);

    try {
      if (isAlreadyIn) {
        // Remove post from collection
        await api.post(`/posts/collections/${collection.id}/remove/${post.id}/`);
        
        // Optimistically mutate cached collections
        mutate(
          collections.map((c) =>
            c.id === collection.id
              ? { ...c, post_ids: c.post_ids.filter((id) => id !== post.id), post_count: c.post_count - 1 }
              : c
          ),
          false
        );
      } else {
        // Add post to collection
        await api.post(`/posts/collections/${collection.id}/add/${post.id}/`);
        
        // Optimistically mutate cached collections
        mutate(
          collections.map((c) =>
            c.id === collection.id
              ? { ...c, post_ids: [...(c.post_ids || []), post.id], post_count: c.post_count + 1 }
              : c
          ),
          false
        );
        
        // Ensure post bookmark status updates to bookmarked in outer UI
        if (onBookmarkToggle && !post.is_bookmarked) {
          onBookmarkToggle(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
      // Keep dropdown open so they can manage multiple folders
    }
  };

  return (
    <div className="absolute right-0 bottom-8 z-30 w-52 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-2.5xl shadow-2xl p-2.5 flex flex-col text-left text-xs font-bold leading-normal select-none">
      <div className="px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">Save to...</span>
      </div>

      {/* List collections */}
      <div className="max-h-40 overflow-y-auto py-1 space-y-0.5">
        {!collections ? (
          <div className="flex items-center justify-center py-4 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            <span>Loading...</span>
          </div>
        ) : collections.length === 0 ? (
          <div className="text-[10px] text-zinc-400 font-semibold px-2 py-3 text-center">
            No folders created yet.
          </div>
        ) : (
          collections.map((collection) => {
            const inCollection = collection.post_ids?.includes(post.id);
            const isLoading = actionLoading === collection.id;

            return (
              <button
                key={collection.id}
                onClick={(e) => handleCollectionClick(e, collection)}
                disabled={isLoading}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center space-x-2 min-w-0 mr-1">
                  <Folder className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{collection.name}</span>
                </div>
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : inCollection ? (
                  <div className="h-4 w-4 bg-primary text-white rounded-md flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                ) : (
                  <div className="h-4 w-4 border border-zinc-300 dark:border-zinc-700 rounded-md shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Shortcuts */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1.5 mt-1 space-y-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCreateOpen(true);
          }}
          className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-primary hover:bg-primary/5 cursor-pointer text-left"
        >
          <FolderPlus className="h-4 w-4" />
          <span>New Collection</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            if (onRemoveConfirm) onRemoveConfirm(e);
          }}
          className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-red-500 hover:bg-red-500/5 cursor-pointer text-left"
        >
          <Bookmark className="h-4 w-4 fill-red-500/10" />
          <span>Remove Bookmark</span>
        </button>
      </div>

      {/* Collection Creation Dialog Modal */}
      <CollectionCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(newCol) => {
          // Mutate the local SWR cache with the new folder
          if (collections) {
            mutate([...collections, { ...newCol, post_ids: [] }], false);
          }
        }}
      />
    </div>
  );
}
