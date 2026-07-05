'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import FollowButton from '@/components/profile/FollowButton';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function FollowingPage() {
  const { username } = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();

  const [followingList, setFollowingList] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 1. Fetch public profile to get user ID
  const { data: profile, error: profileError, isLoading: loadingProfile } = useSWR(
    username ? `/users/profile/${username}/` : null,
    fetcher
  );

  // 2. Fetch following list using SWR
  const profileId = profile?.id;
  const { data: followingData, error: followingError, isLoading: loadingFollowing, mutate } = useSWR(
    profileId ? `/users/${profileId}/following/?page=${page}` : null,
    fetcher
  );

  useEffect(() => {
    if (followingData) {
      const results = followingData.results || [];
      setFollowingList((prev) => page === 1 ? results : [...prev, ...results]);
      setHasNext(!!followingData.next);
    }
  }, [followingData, page]);

  const handleLoadMore = () => {
    if (hasNext && !loadingMore) {
      setPage((p) => p + 1);
    }
  };

  if (profileError || followingError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Following List Not Available</h2>
        <p className="text-sm text-zinc-500 text-center max-w-xs">
          The requested following list could not be loaded or you do not have permission to view it.
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

  const isSelf = profile?.username === currentUser?.username;

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-6 md:px-8">
      <div className="max-w-xl mx-auto space-y-6">

        {/* HEADER BAR */}
        <header className="flex items-center space-x-4 border-b border-zinc-150 dark:border-zinc-850 pb-4 text-left">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-xl text-zinc-650 dark:text-zinc-350 transition cursor-pointer"
            aria-label="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="h-11 w-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Users className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 leading-tight">
              {isSelf ? 'People I Follow' : `Following by @${username}`}
            </h1>
            <p className="text-xs text-zinc-400 font-semibold leading-none mt-0.5">
              {profile?.following_count || 0} following total
            </p>
          </div>
        </header>

        {/* LIST FEED */}
        {loadingProfile || (loadingFollowing && followingList.length === 0) ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl p-4 animate-pulse flex items-center space-x-3.5">
                <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-2.5 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : followingList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-bold text-zinc-450">Not following anyone yet</p>
            <p className="text-xs text-zinc-400 mt-1">When this profile follows other users, they will appear here</p>
          </div>
        ) : (
          <div className="space-y-2 text-left">
            {followingList.map((item) => {
              const u = item.following;
              if (!u) return null;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/80 rounded-2.5xl shadow-sm"
                >
                  <Link href={`/${u.username}`} className="flex items-center space-x-3.5 min-w-0 mr-4">
                    {u.profile_picture ? (
                      <img
                        src={u.profile_picture}
                        alt={u.username}
                        className="h-10 w-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm shrink-0">
                        {u.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                        @{u.username}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-semibold truncate leading-none mt-0.5">
                        {u.full_name}
                      </span>
                    </div>
                  </Link>

                  {currentUser && u.id !== currentUser.id && (
                    <FollowButton
                      userId={u.id}
                      username={u.username}
                      initialIsFollowing={u.is_following}
                      initialFollowRequestPending={u.follow_request_pending}
                      isPrivate={u.is_private}
                      onStateChange={() => {
                        // Dynamically update following list view cache
                        mutate();
                      }}
                    />
                  )}
                </div>
              );
            })}

            {hasNext && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full text-center py-2.5 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer mt-4"
              >
                {loadingMore ? (
                  <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
                ) : (
                  <span>Load More Following</span>
                )}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
