'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Hash, Heart, MessageCircle, Star } from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import PostDetailModal from '@/components/posts/PostDetailModal';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function HashtagPage() {
  const { name } = useParams();
  const router = useRouter();

  const [selectedPostId, setSelectedPostId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  // 1. Fetch hashtag details and posts
  const { data, error, mutate, isLoading } = useSWR(
    name ? `/hashtags/${name.toLowerCase()}/` : null,
    fetcher
  );

  const hashtagDetails = data?.hashtag || {};
  const postsList = data?.posts?.results || [];

  const handleOpenPostDetails = (postId) => {
    setSelectedPostId(postId);
    setIsModalOpen(true);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Hashtag Not Found</h2>
        <p className="text-sm text-zinc-500 max-w-xs text-center">
          The hashtag #{name} could not be loaded or there was a retrieval issue.
        </p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-zinc-250 dark:border-zinc-800 rounded-xl text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-850 transition cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-6 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* HEADER BAR WITH BACK BUTTON */}
        <header className="flex items-center space-x-4 border-b border-zinc-150 dark:border-zinc-850 pb-4 text-left">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-xl text-zinc-650 dark:text-zinc-350 transition cursor-pointer"
            aria-label="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Hash className="h-6 w-6" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 truncate leading-tight">
              #{name}
            </h1>
            <p className="text-xs text-zinc-400 font-semibold leading-none mt-0.5">
              {hashtagDetails.post_count || 0} {hashtagDetails.post_count === 1 ? 'post' : 'posts'}
            </p>
          </div>

          {/* Follow hashtag toggle button (optional visual feature) */}
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center space-x-1.5 ${
              isFollowing 
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-850 dark:text-zinc-350 dark:hover:bg-zinc-800' 
                : 'bg-primary hover:bg-primary-hover text-white'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${isFollowing ? 'fill-yellow-500 text-yellow-500' : ''}`} />
            <span>{isFollowing ? 'Following' : 'Follow Tag'}</span>
          </button>
        </header>

        {/* POSTS GRID */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="aspect-square bg-zinc-200 dark:bg-zinc-850 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : postsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-xs font-bold text-zinc-400">No posts contain #{name} yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 md:gap-3 text-left">
            {postsList.map((post) => {
              const mediaItem = post.media?.[0];
              const hasMedia = !!mediaItem;

              return (
                <div
                  key={post.id}
                  onClick={() => handleOpenPostDetails(post.id)}
                  className="aspect-square relative bg-zinc-150 dark:bg-zinc-900 overflow-hidden group rounded-2xl border border-zinc-100 dark:border-zinc-850 cursor-pointer shadow-sm"
                >
                  {hasMedia ? (
                    <img
                      src={mediaItem.media_url}
                      alt="Hashtag post thumbnail"
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-3 text-center text-[10px] text-zinc-550 font-bold bg-zinc-50 dark:bg-zinc-850 break-words line-clamp-4 select-none">
                      {post.content}
                    </div>
                  )}

                  {/* HOVER STATS */}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-4 text-white font-extrabold text-xs">
                    <span className="flex items-center"><Heart className="h-4 w-4 mr-1 fill-white" /> {post.like_count || 0}</span>
                    <span className="flex items-center"><MessageCircle className="h-4 w-4 mr-1 fill-white" /> {post.comment_count || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* OVERLAY post details modal */}
      <PostDetailModal
        postId={selectedPostId}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPostId(null);
        }}
      />
    </div>
  );
}
