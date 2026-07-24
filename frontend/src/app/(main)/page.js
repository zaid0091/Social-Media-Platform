'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import PostCard from '@/components/posts/PostCard';
import PostCardSkeleton from '@/components/ui/PostCardSkeleton';
import StoriesBar from '@/components/stories/StoriesBar';
import { ArrowUp, RefreshCw, Compass, Users } from 'lucide-react';
import Link from 'next/link';
import useFeedQuery from '@/hooks/useFeedQuery';
import { postKeys } from '@/utils/queryKeys';
import FlatList from '@/components/ui/FlatList';
import OptimizedImage from '@/components/ui/OptimizedImage';
import PullToRefresh from '@/components/ui/PullToRefresh';

export default function HomeFeedPage() {
  const { user: currentUser, accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const socketRef = useRef(null);

  // Fetch paginated feed using useFeedQuery
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading,
    error,
    refetch
  } = useFeedQuery();

  const posts = feedData?.pages.flatMap(page => page.results) || [];

  // WebSocket Connection listener for real-time feed notifications
  useEffect(() => {
    if (!accessToken) return;

    // Connect to django channels ws endpoint
    const wsUrl = `ws://127.0.0.1:8000/ws/feed/?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_post') {
          // If the post author is not the current user, trigger the banner alert
          if (currentUser && data.post?.author?.id !== currentUser.id) {
            setNewPostsAvailable(true);
          }
        }
      } catch (err) {}
    };

    return () => {
      if (ws) ws.close();
    };
  }, [accessToken, currentUser]);

  const handleRefreshFeed = () => {
    setNewPostsAvailable(false);
    refetch();
  };

  const handlePostDeleted = (deletedId) => {
    queryClient.setQueryData(postKeys.feed(), (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          results: page.results.filter((p) => p.id !== deletedId)
        }))
      };
    });
  };

  // Fetcher for suggestions using React Query
  const { data: suggestions } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.get('/users/suggestions/').then(r => r.data)
  });

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="flex flex-col min-h-screen relative bg-white dark:bg-zinc-900">
        {/* 1. Sticky page header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Home</h1>
      </header>

      {/* 2. Real-Time New Posts Alert Banner */}
      {newPostsAvailable && (
        <div className="sticky top-[57px] z-10 w-full px-4 py-2 bg-primary/10 border-b border-primary/20 backdrop-blur flex justify-center">
          <button 
            onClick={handleRefreshFeed}
            className="flex items-center space-x-2 px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-full shadow-md shadow-primary/25 hover:shadow-primary/35 transition-all animate-bounce cursor-pointer"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>New posts available! Click to refresh</span>
          </button>
        </div>
      )}

      {/* 3. Horizontal Stories row */}
      <StoriesBar />

      {/* 4. Feed List area */}
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item: post }) => (
          <PostCard 
            key={post.id} 
            post={post} 
            onDelete={handlePostDeleted} 
          />
        )}
        fetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={loading}
        isError={!!error}
        error={error}
        refetch={refetch}
        className="flex-1 divide-y divide-zinc-200 dark:divide-zinc-800"
        ListFooterComponent={
          <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 w-full">
            {[1, 2].map((i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        }
        ListEmptyComponent={
          <div className="flex flex-col items-center justify-center text-center p-12 space-y-4 my-8 w-full">
            <div className="h-16 w-16 bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 rounded-full flex items-center justify-center shadow-inner">
              <Compass className="h-7 w-7" />
            </div>
            
            <div className="flex flex-col space-y-1.5 max-w-xs">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-zinc-50">Welcome to your feed!</h3>
              <p className="text-sm text-zinc-500 leading-normal">
                Follow some accounts to see their images, videos, and real-time updates here.
              </p>
            </div>

            <div className="w-full max-w-sm pt-4 border-t border-zinc-150 dark:border-zinc-800/80 space-y-4">
              <span className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center justify-center space-x-1.5">
                <Users className="h-4 w-4" />
                <span>Suggested Creators</span>
              </span>

              <div className="flex flex-col space-y-3 bg-zinc-50/50 dark:bg-zinc-950/20 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                {suggestions && suggestions.length > 0 ? (
                  suggestions.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-left">
                      <Link href={`/${item.username}`} className="flex items-center space-x-3 min-w-0 group">
                        {item.profile_picture ? (
                          <OptimizedImage 
                            src={item.profile_picture} 
                            alt={item.username} 
                            width={32}
                            height={32}
                            className="rounded-full object-cover shrink-0" 
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs shrink-0">
                            {item.username?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate leading-tight group-hover:underline">{item.full_name || item.username}</span>
                          <span className="text-[10px] text-zinc-500 truncate">@{item.username}</span>
                        </div>
                      </Link>
                      
                      <button
                        onClick={async () => {
                          await api.post(`/users/follow/${item.id}/`);
                          handleRefreshFeed();
                        }}
                        className="px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer select-none"
                      >
                        Follow
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">Search for trending keywords to get started</span>
                )}
              </div>
            </div>
          </div>
        }
      />
    </div>
    </PullToRefresh>
  );
}
