'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { UserPlus, UserCheck, Sparkles } from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import FollowButton from '@/components/profile/FollowButton';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function SuggestedUsersWidget() {
  const { user: currentUser } = useAuthStore();

  // Query suggestions from upgraded backend endpoint
  const { data: suggestions = [], isLoading, mutate } = useSWR(
    currentUser ? '/users/suggestions/' : null,
    fetcher
  );

  if (isLoading && suggestions.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-4.5 shadow-sm space-y-4 animate-pulse">
        <div className="h-3 w-1/3 bg-zinc-200 dark:bg-zinc-850 rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-8.5 w-8.5 rounded-full bg-zinc-200 dark:bg-zinc-850" />
                <div className="space-y-1">
                  <div className="h-2.5 w-16 bg-zinc-200 dark:bg-zinc-850 rounded" />
                  <div className="h-2 w-20 bg-zinc-200 dark:bg-zinc-850 rounded" />
                </div>
              </div>
              <div className="h-6 w-14 bg-zinc-200 dark:bg-zinc-850 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Cap suggestions list to 3 items as a Who To Follow widget
  const displaySuggestions = suggestions.slice(0, 3);

  if (displaySuggestions.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-4.5 shadow-sm space-y-4 text-left">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center space-x-1">
          <Sparkles className="h-3 w-3 text-primary fill-primary" />
          <span>Who to follow</span>
        </h3>
        <Link 
          href="/discover" 
          className="text-[10px] font-black text-primary hover:underline cursor-pointer select-none"
        >
          See More
        </Link>
      </div>

      {/* Suggested profiles list map */}
      <div className="flex flex-col space-y-3.5">
        {displaySuggestions.map((u) => (
          <div key={u.id} className="flex items-start justify-between space-x-3">
            <Link 
              href={`/${u.username}`} 
              className="flex items-start space-x-2.5 min-w-0 group"
            >
              {u.profile_picture ? (
                <img
                  src={u.profile_picture}
                  alt={u.username}
                  className="h-8.5 w-8.5 rounded-full object-cover shrink-0 border border-zinc-100 dark:border-zinc-800 mt-0.5"
                />
              ) : (
                <div className="h-8.5 w-8.5 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs shrink-0 mt-0.5">
                  {u.username?.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 truncate group-hover:underline leading-none">
                    {u.full_name || `@${u.username}`}
                  </span>
                  {u.is_verified && <span className="text-blue-500 text-[10px]">✓</span>}
                </div>
                {u.full_name && (
                  <span className="text-[9px] text-zinc-400 font-semibold leading-none mt-0.5">
                    @{u.username}
                  </span>
                )}
                {u.bio && (
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-450 font-medium line-clamp-1 mt-1 leading-tight break-words">
                    {u.bio}
                  </p>
                )}
              </div>
            </Link>

            <FollowButton
              userId={u.id}
              username={u.username}
              initialIsFollowing={u.is_following}
              initialFollowRequestPending={u.follow_request_pending}
              isPrivate={u.is_private}
              className="!px-2.5 !py-1 text-[10px] shrink-0 mt-0.5"
              onStateChange={() => {
                // Mutate SWR suggestions on follow status update to refresh list
                mutate();
              }}
            />
          </div>
        ))}
      </div>

    </div>
  );
}
