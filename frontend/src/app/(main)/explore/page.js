'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Heart, MessageCircle, Hash, Compass, ArrowRight, UserPlus, UserCheck, Flame } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import PostDetailModal from '@/components/posts/PostDetailModal';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function ExplorePage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();

  const [activeCategory, setActiveCategory] = useState('for_you'); // 'for_you' | 'photos' | 'videos' | 'trending'
  
  // Feed states for infinite scroll
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modal detailed overlay states
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Fetch suggested users
  const { data: suggestionsData } = useSWR('/search/suggested/', fetcher);
  const suggestedUsers = (suggestionsData?.suggested_users || []).slice(0, 6);

  // 2. Fetch trending hashtags
  const { data: trendingHashtags = [] } = useSWR('/hashtags/trending/', fetcher);

  // 3. Load posts feed
  const loadPostsFeed = async (pageNumber, isRefresh = false) => {
    if (isRefresh) setLoadingPosts(true);
    else setLoadingMore(true);

    try {
      const res = await api.get(`/posts/explore/?category=${activeCategory}&page=${pageNumber}`);
      const results = res.data.results || [];
      setPosts((prev) => isRefresh ? results : [...prev, ...results]);
      setHasNext(!!res.data.next);
    } catch (err) {
      console.error('Failed to load explore feed posts', err);
    } finally {
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  };

  // Trigger loading when active category or page changes
  useEffect(() => {
    setPage(1);
    loadPostsFeed(1, true);
  }, [activeCategory]);

  useEffect(() => {
    if (page > 1) {
      loadPostsFeed(page, false);
    }
  }, [page]);

  // Window scroll hook for Infinite Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120 &&
        hasNext &&
        !loadingPosts &&
        !loadingMore
      ) {
        setPage((p) => p + 1);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasNext, loadingPosts, loadingMore]);

  // Follow/Unfollow toggle inside suggestion cards
  const handleFollowToggle = async (userId, username, isFollowing) => {
    try {
      if (isFollowing) {
        await api.post(`/users/${username}/unfollow/`);
      } else {
        await api.post(`/users/${username}/follow/`);
      }
      // Re-trigger SWR revalidation to sync suggested cards followers status
      mutate('/search/suggested/');
    } catch (err) {
      console.error('Failed to toggle follow from explore suggests', err);
    }
  };

  const handleOpenPostDetails = (postId) => {
    setSelectedPostId(postId);
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col text-left">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-tight flex items-center space-x-2">
            <Compass className="h-6 w-6 text-primary" />
            <span>Explore</span>
          </h1>
          <p className="text-xs text-zinc-400 font-semibold mt-0.5 leading-none">Discover what's hot and trending today</p>
        </div>

        {/* CATEGORIES BAR */}
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'for_you', label: 'For You' },
            { id: 'trending', label: 'Trending' },
            { id: 'photos', label: 'Photos' },
            { id: 'videos', label: 'Videos' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 text-xs font-black rounded-2-full border transition cursor-pointer shrink-0 select-none ${
                activeCategory === cat.id
                  ? 'bg-primary border-primary text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-850'
              }`}
            >
              {cat.id === 'trending' && <Flame className="h-3.5 w-3.5 inline mr-1 text-orange-500 fill-orange-500" />}
              {cat.label}
            </button>
          ))}
        </div>

        {/* TRENDING HASHTAGS ROW */}
        {trendingHashtags.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-4 shadow-sm text-left">
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block mb-3">Trending Topics</span>
            <div className="flex space-x-2.5 overflow-x-auto scrollbar-none py-0.5">
              {trendingHashtags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/hashtag/${tag.name}`}
                  className="px-3.5 py-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 text-xs font-extrabold text-zinc-700 dark:text-zinc-250 border border-zinc-150 dark:border-zinc-800 rounded-2-full shadow-sm transition flex items-center space-x-1 shrink-0"
                >
                  <Hash className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{tag.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* EXPLORE COLUMN LAYOUT: Side suggestions + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* MAIN POST GRID AREA */}
          <div className="lg:col-span-3 space-y-4">
            
            {loadingPosts && posts.length === 0 ? (
              // Initial Loading skeleton
              <div className="columns-2 sm:columns-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2.5xl p-3 mb-3 animate-pulse space-y-2.5 break-inside-avoid">
                    <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                    <div className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              // Empty search list
              <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center">
                <p className="text-sm font-bold text-zinc-450">No trending content found</p>
                <p className="text-xs text-zinc-400 mt-1">Check back later for trending photos and videos</p>
              </div>
            ) : (
              
              // MASONRY CONTENT GRID
              <div className="columns-2 sm:columns-3 gap-3">
                {posts.map((post, idx) => {
                  const mediaItem = post.media?.[0];
                  const hasMedia = !!mediaItem;
                  const isPostVideo = mediaItem?.media_type === 'video';

                  return (
                    <div
                      key={post.id}
                      onClick={() => handleOpenPostDetails(post.id)}
                      className={`break-inside-avoid bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 overflow-hidden mb-3 rounded-2.5xl group shadow-sm flex flex-col relative cursor-pointer ${
                        idx === 0 ? 'border-primary/20 ring-1 ring-primary/10' : ''
                      }`}
                    >
                      {/* Media frame */}
                      {hasMedia ? (
                        <div className="relative overflow-hidden w-full bg-zinc-950/20">
                          <img
                            src={mediaItem.media_url}
                            alt="Explore thumbnail"
                            className="w-full object-cover max-h-[320px] min-h-[140px] transition duration-300 group-hover:scale-103"
                          />
                          {isPostVideo && (
                            <span className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md">
                              Video
                            </span>
                          )}
                        </div>
                      ) : (
                        // Text post box preview
                        <div className="p-4 text-left border-b border-zinc-100 dark:border-zinc-850 max-h-[180px] overflow-hidden select-none">
                          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-bold break-words line-clamp-5">
                            {post.content}
                          </p>
                        </div>
                      )}

                      {/* Header details inside card */}
                      <div className="p-3 flex items-center justify-between text-[10px] text-zinc-450 font-bold">
                        <div className="flex items-center space-x-1.5 min-w-0 mr-2">
                          <img
                            src={post.author?.profile_picture || '/default-avatar.png'}
                            alt={post.author?.username}
                            className="h-4.5 w-4.5 rounded-full object-cover shrink-0"
                          />
                          <span className="truncate text-zinc-650 dark:text-zinc-350">@{post.author?.username}</span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="flex items-center"><Heart className="h-3 w-3 mr-0.5" /> {post.like_count || 0}</span>
                        </div>
                      </div>

                      {/* HOVER OVERLAY INFO */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-5 text-white font-extrabold text-xs">
                        <span className="flex items-center"><Heart className="h-4 w-4 mr-1 fill-white" /> {post.like_count || 0}</span>
                        <span className="flex items-center"><MessageCircle className="h-4 w-4 mr-1 fill-white" /> {post.comment_count || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom loading indicators */}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
              </div>
            )}
          </div>

          {/* SIDE SUGGESTED accounts panel */}
          <div className="hidden lg:block lg:col-span-1 text-left space-y-4">
            <div className="sticky top-20 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-4.5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Suggested Creators</h2>
              </div>
              
              <div className="flex flex-col space-y-3.5">
                {suggestedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between space-x-2">
                    <Link href={`/${u.username}`} className="flex items-center space-x-2.5 min-w-0">
                      <img
                        src={u.profile_picture || '/default-avatar.png'}
                        alt={u.username}
                        className="h-8.5 w-8.5 rounded-full object-cover shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                          @{u.username}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-semibold truncate leading-none mt-0.5">
                          {u.follower_count} followers
                        </span>
                      </div>
                    </Link>
                    
                    <button
                      onClick={() => handleFollowToggle(u.id, u.username, u.is_following)}
                      className={`p-1.5 rounded-lg transition shrink-0 cursor-pointer ${
                        u.is_following
                          ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-350'
                          : 'bg-primary hover:bg-primary-hover text-white'
                      }`}
                      title={u.is_following ? 'Unfollow' : 'Follow'}
                    >
                      {u.is_following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

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
