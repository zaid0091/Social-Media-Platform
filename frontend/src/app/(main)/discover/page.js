'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Compass, Sparkles, UserPlus, Users, BadgeCheck } from 'lucide-react';
import api from '@/services/api';
import FollowButton from '@/components/profile/FollowButton';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function DiscoverPeoplePage() {
  const [activeTab, setActiveTab] = useState('popular'); // 'popular' | 'new_users' | 'network'

  const { data: suggestions, isLoading, mutate } = useSWR(
    '/users/suggestions/discover/',
    fetcher
  );

  const getActiveList = () => {
    if (!suggestions) return [];
    if (activeTab === 'popular') return suggestions.popular || [];
    if (activeTab === 'new_users') return suggestions.new_users || [];
    if (activeTab === 'network') return suggestions.network || [];
    return [];
  };

  const activeList = getActiveList();

  const tabs = [
    { id: 'popular', label: 'Popular', icon: Sparkles },
    { id: 'new_users', label: 'New Users', icon: UserPlus },
    { id: 'network', label: 'In Your Network', icon: Users }
  ];

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-6 md:px-8">
      <div className="max-w-3xl mx-auto space-y-6 text-left">
        
        {/* Page Header */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
            <Compass className="h-6 w-6 text-primary" />
            <span>Discover People</span>
          </h1>
          <p className="text-xs text-zinc-400 font-semibold mt-0.5">Find interesting creators, new accounts, and people in your network.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 pb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 pb-3.5 px-4 text-xs font-black transition-all border-b-2 cursor-pointer relative -bottom-[2px] ${
                  isActive 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-350'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Suggestions List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-5 flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                </div>
                <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : activeList.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-12 text-center">
            <p className="text-sm font-black text-zinc-450">No suggestions in this category</p>
            <p className="text-xs text-zinc-400 mt-1">Check back later or explore other sections</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeList.map((u) => (
              <div 
                key={u.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-5 flex items-start justify-between space-x-4 hover:shadow-sm transition-all"
              >
                <div className="flex items-start space-x-4 min-w-0">
                  <Link href={`/${u.username}`} className="shrink-0 block mt-0.5">
                    {u.profile_picture ? (
                      <img
                        src={u.profile_picture}
                        alt={u.username}
                        className="h-12 w-12 rounded-full object-cover border border-zinc-100 dark:border-zinc-800"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-base">
                        {u.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-col min-w-0 space-y-1">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <Link 
                        href={`/${u.username}`}
                        className="text-sm font-black text-zinc-900 dark:text-zinc-50 hover:underline leading-none"
                      >
                        {u.full_name || `@${u.username}`}
                      </Link>
                      {u.is_verified && <BadgeCheck className="h-4 w-4 text-blue-500 fill-blue-500 shrink-0" />}
                    </div>
                    {u.full_name && (
                      <span className="text-xs text-zinc-450 font-semibold leading-none">
                        @{u.username}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 font-semibold leading-none pt-0.5">
                      {u.follower_count || 0} followers
                    </span>
                    {u.bio && (
                      <p className="text-xs text-zinc-650 dark:text-zinc-400 font-medium leading-relaxed pt-1.5 break-words">
                        {u.bio}
                      </p>
                    )}
                  </div>
                </div>

                <FollowButton
                  userId={u.id}
                  username={u.username}
                  initialIsFollowing={u.is_following}
                  initialFollowRequestPending={u.follow_request_pending}
                  isPrivate={u.is_private}
                  className="!px-4 !py-2 text-xs font-black shrink-0 mt-0.5"
                  onStateChange={() => {
                    mutate();
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
