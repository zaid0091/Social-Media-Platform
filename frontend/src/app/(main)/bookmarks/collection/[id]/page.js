'use client';

import { useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Folder, 
  Trash2, 
  ArrowLeft, 
  Grid, 
  List,
  Film,
  FileText,
  Loader2,
  FolderOpen
} from 'lucide-react';
import api from '@/services/api';
import PostCard from '@/components/posts/PostCard';
import SkeletonPostCard from '@/components/posts/SkeletonPostCard';

export default function CollectionDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const collectionId = resolvedParams.id;

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [deleting, setDeleting] = useState(false);

  // Fetch collection detailed feed
  const { data: collection, error, mutate } = useSWR(`/posts/collections/${collectionId}/`, () =>
    api.get(`/posts/collections/${collectionId}/`).then((res) => res.data)
  );

  const posts = collection?.posts || [];
  const loading = !collection && !error;

  const handleDeleteCollection = async () => {
    if (!confirm('Are you sure you want to delete this collection? Saved bookmarks will not be deleted.')) {
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/posts/collections/${collectionId}/`);
      router.push('/bookmarks');
    } catch (err) {
      alert('Failed to delete collection.');
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col text-left">
      
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <button
            onClick={() => router.push('/bookmarks')}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
            aria-label="Back to bookmarks"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          
          <div>
            <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
              <Folder className="h-5.5 w-5.5 text-primary" />
              <span>{loading ? 'Folder' : collection?.name}</span>
            </h1>
            <p className="text-[10px] text-zinc-400 font-semibold mt-0.5 leading-none">
              {!loading && `${posts.length} ${posts.length === 1 ? 'saved post' : 'saved posts'} in this folder`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* View Toggles */}
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

          <span className="w-px h-6 bg-zinc-200 dark:bg-zinc-850 mx-1.5" />

          {/* Delete folder button */}
          <button
            onClick={handleDeleteCollection}
            disabled={deleting}
            className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Delete Collection"
          >
            {deleting ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Trash2 className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      {/* FEED LIST AREA */}
      <div className="max-w-xl w-full mx-auto p-4 md:p-6 flex-1">
        
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
              <FolderOpen className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Empty Collection</h3>
            <p className="text-[10px] text-zinc-400 font-semibold max-w-xs mt-1 leading-relaxed">
              No posts have been assigned to this folder yet. Assign items to this collection directly from post bookmark popovers.
            </p>
          </div>
        )}

        {/* LIST VIEW */}
        {!loading && viewMode === 'list' && posts.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/80 rounded-3xl divide-y divide-zinc-150 dark:divide-zinc-800/60 shadow-sm overflow-hidden">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={() => mutate()} // Refresh feed
              />
            ))}
          </div>
        )}

        {/* GRID VIEW */}
        {!loading && viewMode === 'grid' && posts.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {posts.map((post) => {
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

      </div>
    </div>
  );
}
