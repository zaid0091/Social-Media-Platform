'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { 
  Bookmark, 
  Grid, 
  List, 
  FolderPlus, 
  ChevronRight, 
  Folder, 
  Clock, 
  ArrowUpDown,
  Image as ImageIcon,
  Film,
  FileText
} from 'lucide-react';
import api from '@/services/api';
import PostCard from '@/components/posts/PostCard';
import SkeletonPostCard from '@/components/posts/SkeletonPostCard';
import CollectionCreateModal from '@/components/posts/CollectionCreateModal';

export default function BookmarksPage() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Fetch bookmarks
  const { data: bookmarksData, error: bookmarksError, mutate: mutateBookmarks } = useSWR('/posts/bookmarks/', () =>
    api.get('/posts/bookmarks/').then((res) => res.data)
  );

  // Fetch collections
  const { data: collections, mutate: mutateCollections } = useSWR('/posts/collections/', () =>
    api.get('/posts/collections/').then((res) => res.data)
  );

  const posts = bookmarksData?.results || [];
  const loading = !bookmarksData && !bookmarksError;

  // Local sorting based on created_at timestamp
  const sortedPosts = [...posts].sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col text-left">
      
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
            <Bookmark className="h-5.5 w-5.5 text-primary" />
            <span>Bookmarks</span>
          </h1>
          <p className="text-[10px] text-zinc-400 font-semibold mt-0.5 leading-none">Manage your saved posts and custom collection folders</p>
        </div>

        {/* View Mode controls */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl transition cursor-pointer ${
              viewMode === 'list' 
                ? 'bg-primary/10 text-primary' 
                : 'text-zinc-450 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="List View"
          >
            <List className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl transition cursor-pointer ${
              viewMode === 'grid' 
                ? 'bg-primary/10 text-primary' 
                : 'text-zinc-450 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Grid View"
          >
            <Grid className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="max-w-5xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        
        {/* LEFT COLUMN: Collections Folders Sidebar */}
        <aside className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4 px-1.5">
              <h2 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Collections</h2>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="p-1.5 hover:bg-primary/10 text-primary rounded-xl transition cursor-pointer"
                title="Create new collection folder"
              >
                <FolderPlus className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Collections scroll grid list */}
            <div className="space-y-1">
              {!collections ? (
                <div className="space-y-2">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-11 w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : collections.length === 0 ? (
                <p className="text-[11px] text-zinc-450 font-bold text-center py-4 leading-relaxed">
                  No collection folders created.<br />
                  <span className="text-[10px] text-zinc-400 font-semibold">Organize posts into lists by creating folders.</span>
                </p>
              ) : (
                collections.map((col) => (
                  <Link
                    key={col.id}
                    href={`/bookmarks/collection/${col.id}`}
                    className="flex items-center justify-between p-3 rounded-2xl border border-transparent hover:border-zinc-200/30 dark:hover:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition group"
                  >
                    <div className="flex items-center space-x-3 min-w-0 mr-1">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Folder className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-zinc-800 dark:text-zinc-205 truncate leading-tight">
                          {col.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-bold leading-none mt-0.5">
                          {col.post_count} {col.post_count === 1 ? 'post' : 'posts'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Bookmarked Feed Area */}
        <main className="md:col-span-2 space-y-4">
          
          {/* SORTING CONTROLS */}
          {posts.length > 0 && (
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/80 rounded-2xl px-4 py-3 shadow-sm">
              <span className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">
                Showing {posts.length} saved {posts.length === 1 ? 'post' : 'posts'}
              </span>

              <div className="flex items-center space-x-1.5 text-xs font-bold text-zinc-500">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="bg-transparent text-zinc-700 dark:text-zinc-300 border-none outline-none focus:ring-0 cursor-pointer text-xs"
                >
                  <option value="newest">Newest Saved</option>
                  <option value="oldest">Oldest Saved</option>
                </select>
              </div>
            </div>
          )}

          {/* LOADING SKELETONS */}
          {loading && (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <SkeletonPostCard key={n} />
              ))}
            </div>
          )}

          {/* EMPTY STATE */}
          {!loading && posts.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/80 rounded-3xl p-10 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="h-14 w-14 rounded-2.5xl bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center border border-zinc-200/30 dark:border-zinc-800/60 mb-4 text-zinc-400">
                <Bookmark className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50 tracking-tight">No bookmarks yet</h3>
              <p className="text-[10px] text-zinc-400 font-semibold max-w-xs mt-1 leading-relaxed">
                Save posts for later! Tap the bookmark icon on any post card to save it here.
              </p>
            </div>
          )}

          {/* LIST VIEW */}
          {!loading && viewMode === 'list' && sortedPosts.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/80 rounded-3xl divide-y divide-zinc-150 dark:divide-zinc-800/60 shadow-sm overflow-hidden">
              {sortedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={() => mutateBookmarks()} // refresh list on delete
                />
              ))}
            </div>
          )}

          {/* GRID VIEW */}
          {!loading && viewMode === 'grid' && sortedPosts.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              {sortedPosts.map((post) => {
                const hasVideo = post.media?.some(m => m.media_type === 'video');
                const hasImage = post.media?.length > 0 && !hasVideo;
                
                return (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="aspect-square rounded-2xl border border-zinc-200/35 dark:border-zinc-800/60 overflow-hidden bg-zinc-100 dark:bg-zinc-950 relative hover:opacity-90 transition group flex items-center justify-center select-none"
                  >
                    {hasImage && (
                      <img
                        src={post.media[0].media_url}
                        alt="Saved Post Preview"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {hasVideo && (
                      <>
                        <img
                          src={post.media[0].thumbnail_url || post.media[0].media_url}
                          alt="Saved Video Preview"
                          className="w-full h-full object-cover filter brightness-75"
                        />
                        <Film className="absolute top-2.5 right-2.5 h-4 w-4 text-white drop-shadow" />
                      </>
                    )}
                    {!hasImage && !hasVideo && (
                      <div className="p-3 text-center flex flex-col items-center justify-center h-full space-y-1">
                        <FileText className="h-5 w-5 text-zinc-400 group-hover:text-primary transition" />
                        <span className="text-[9px] text-zinc-500 font-bold line-clamp-3">
                          {post.content}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

        </main>
      </div>

      {/* Collection Creation Dialog Modal */}
      <CollectionCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => mutateCollections()}
      />

    </div>
  );
}
