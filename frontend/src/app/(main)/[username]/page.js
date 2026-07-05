'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import HighlightCreateModal from '@/components/stories/HighlightCreateModal';
import HighlightEditModal from '@/components/stories/HighlightEditModal';
import StoryViewer from '@/components/stories/StoryViewer';
import { 
  Lock, 
  MapPin, 
  Link as LinkIcon, 
  Calendar, 
  Grid, 
  Video, 
  UserCheck, 
  Heart, 
  MessageCircle, 
  MessageSquare,
  Globe,
  Plus,
  FolderHeart,
  Settings
} from 'lucide-react';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function ProfilePage() {
  const { username } = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('posts');

  // 1. Fetch public profile details
  const fetchUrl = username === 'profile' 
    ? '/users/profile/' 
    : `/users/profile/${username}/`;

  const { 
    data: profile, 
    error: profileError, 
    mutate: mutateProfile 
  } = useSWR(
    username ? fetchUrl : null,
    fetcher
  );

  // Auto-redirect /profile to /[username] when currentUser is loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && username === 'profile' && currentUser?.username) {
      router.replace(`/${currentUser.username}`);
    }
  }, [username, currentUser, router]);

  // 2. Fetch profile posts (only if profile is accessible)
  const { 
    data: postsData, 
    error: postsError 
  } = useSWR(
    profile?.is_accessible && profile?.id ? `/posts/user/${profile.id}/` : null,
    fetcher
  );

  const posts = postsData?.results || [];

  const [isCreateHighlightOpen, setIsCreateHighlightOpen] = useState(false);
  const [isEditHighlightOpen, setIsEditHighlightOpen] = useState(false);
  const [editHighlightTarget, setEditHighlightTarget] = useState(null);
  const [activeHighlight, setActiveHighlight] = useState(null);

  // 2b. Fetch user highlights
  const { 
    data: highlights = [], 
    mutate: mutateHighlights 
  } = useSWR(
    profile?.is_accessible ? `/stories/highlights/user/${profile.username}/` : null,
    fetcher
  );

  // 3. Follow/Unfollow handler with optimistic SWR mutations
  const handleFollowToggle = async () => {
    if (!profile) return;

    const wasFollowing = profile.is_following;
    const isPrivate = profile.is_private;
    const isPending = profile.follow_request_pending;

    // Construct optimistic layout state updates
    let updatedProfile = { ...profile };
    if (wasFollowing) {
      updatedProfile.is_following = false;
      updatedProfile.follower_count = Math.max(0, updatedProfile.follower_count - 1);
    } else if (isPending) {
      updatedProfile.follow_request_pending = false;
    } else {
      if (isPrivate) {
        updatedProfile.follow_request_pending = true;
      } else {
        updatedProfile.is_following = true;
        updatedProfile.follower_count += 1;
      }
    }

    // Apply immediate optimistic state update to cache
    mutateProfile(updatedProfile, { revalidate: false });

    try {
      if (wasFollowing || isPending) {
        await api.post(`/users/unfollow/${profile.id}/`);
      } else {
        await api.post(`/users/follow/${profile.id}/`);
      }
      // Revalidate to ensure server and client count align
      mutateProfile();
    } catch (err) {
      // Revert cache to initial state if API throws
      mutateProfile(profile);
    }
  };

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Profile Not Available</h2>
        <p className="text-sm text-zinc-500 max-w-xs text-center">
          The requested profile could not be found or you may not have permission to view it.
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 rounded-full border-4 border-zinc-200 dark:border-zinc-800 border-t-primary animate-spin" />
      </div>
    );
  }

  const isSelf = profile.is_self;

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Header / Navbar Navigation */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center space-x-4">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold truncate max-w-[200px]">{profile.full_name || profile.username}</h1>
          <span className="text-xs text-zinc-500 font-medium">
            {profile.is_accessible ? `${profile.post_count || 0} posts` : 'Private Account'}
          </span>
        </div>
      </header>

      {/* 2. Cover Photo Section */}
      <div className="h-32 sm:h-48 w-full bg-zinc-200 dark:bg-zinc-800 relative">
        {profile.cover_photo ? (
          <img 
            src={profile.cover_photo} 
            alt="Cover" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/30 to-secondary/30" />
        )}
      </div>

      {/* 3. Profile Information Panel */}
      <div className="px-6 pb-6 relative flex flex-col space-y-4">
        {/* Profile Avatar and Actions row */}
        <div className="flex justify-between items-end -mt-16 sm:-mt-20">
          <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-white dark:border-zinc-900 bg-zinc-150 overflow-hidden relative shadow-md">
            {profile.profile_picture ? (
              <img 
                src={profile.profile_picture} 
                alt={profile.username} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl sm:text-4xl font-black">
                {profile.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Action buttons (Follow, Edit, Message) */}
          <div className="flex items-center space-x-2 pb-2">
            {isSelf ? (
              <button 
                onClick={() => router.push('/settings')}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none"
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push(`/messages?userId=${profile.id}`)}
                  className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-650 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  aria-label="Send Message"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>

                <button
                  onClick={handleFollowToggle}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none ${
                    profile.is_following
                      ? 'bg-zinc-155 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-900 dark:text-zinc-50'
                      : profile.follow_request_pending
                      ? 'bg-zinc-100 dark:bg-zinc-850 text-zinc-550 cursor-default'
                      : 'bg-primary hover:bg-primary-hover text-white'
                  }`}
                >
                  {profile.is_following 
                    ? 'Following' 
                    : profile.follow_request_pending 
                    ? 'Requested' 
                    : 'Follow'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="flex flex-col space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black leading-none">{profile.full_name || profile.username}</h2>
          <span className="text-zinc-500 text-sm">@{profile.username}</span>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-[15px] text-zinc-805 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
        )}

        {/* Links & Date Metas */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-zinc-500 text-sm font-medium">
          {profile.location && (
            <div className="flex items-center space-x-1">
              <MapPin className="h-4 w-4" />
              <span>{profile.location}</span>
            </div>
          )}
          {profile.website && (
            <div className="flex items-center space-x-1 text-primary hover:underline cursor-pointer">
              <LinkIcon className="h-4 w-4" />
              <a href={profile.website} target="_blank" rel="noopener noreferrer">{profile.website}</a>
            </div>
          )}
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Follower / Following counter statistics */}
        <div className="flex space-x-6 pt-2">
          <div className="flex items-center space-x-1 text-[15px]">
            <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{profile.following_count || 0}</span>
            <span className="text-zinc-500 font-medium">Following</span>
          </div>
          <div className="flex items-center space-x-1 text-[15px]">
            <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{profile.follower_count || 0}</span>
            <span className="text-zinc-500 font-medium">Followers</span>
          </div>
          <div className="flex items-center space-x-1 text-[15px]">
            <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{profile.post_count || 0}</span>
            <span className="text-zinc-500 font-medium">Posts</span>
          </div>
        </div>
      </div>

      {/* Highlights Section */}
      {profile.is_accessible && (
        <div className="px-6 pb-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 overflow-hidden select-none">
          <div className="flex space-x-4 overflow-x-auto scrollbar-none py-1">
            {/* Create New Highlight Bubble (only for own profile) */}
            {isSelf && (
              <div className="flex flex-col items-center space-y-1 shrink-0">
                <button
                  onClick={() => setIsCreateHighlightOpen(true)}
                  className="h-14 w-14 rounded-full border border-zinc-300 dark:border-zinc-800 hover:border-primary flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/45 cursor-pointer hover:scale-105 transition-all"
                >
                  <Plus className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                </button>
                <span className="text-[10px] text-zinc-550 dark:text-zinc-400 font-bold">New</span>
              </div>
            )}

            {/* Existing Highlights */}
            {highlights && highlights.map((highlight) => (
              <div key={highlight.id} className="flex flex-col items-center space-y-1 shrink-0 relative group">
                <div className="relative">
                  <button
                    onClick={() => handleOpenHighlight(highlight)}
                    className="h-14 w-14 rounded-full border border-zinc-250 dark:border-zinc-800 p-[2px] hover:border-primary flex items-center justify-center bg-zinc-55 dark:bg-zinc-900 overflow-hidden cursor-pointer hover:scale-105 transition-all"
                  >
                    <div className="h-full w-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                      {highlight.cover_image ? (
                        <img 
                          src={highlight.cover_image} 
                          alt={highlight.title} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                          <FolderHeart className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Settings gear trigger icon for self editing */}
                  {isSelf && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditHighlightTarget(highlight);
                        setIsEditHighlightOpen(true);
                      }}
                      className="absolute -bottom-1 -right-1 p-1 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-full transition cursor-pointer z-10"
                      aria-label="Edit Highlight"
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <span className="text-[10px] text-zinc-800 dark:text-zinc-300 font-bold truncate max-w-[65px]">
                  {highlight.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Navigation Tab Bar */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 flex justify-center space-x-12 px-6">
        {[
          { id: 'posts', label: 'Posts', icon: Grid },
          { id: 'reels', label: 'Reels', icon: Video },
          { id: 'tagged', label: 'Tagged', icon: UserCheck },
          ...(isSelf ? [{ id: 'liked', label: 'Liked', icon: Heart }] : [])
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 border-t-2 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 5. Main Content Panel */}
      <div className="p-4 sm:p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/10 flex-1">
        {!profile.is_accessible ? (
          /* Private Profile Locked Card */
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-850 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Lock className="h-7 w-7" />
            </div>
            <div className="flex flex-col space-y-1.5 max-w-sm">
              <h3 className="font-extrabold text-lg">This Account is Private</h3>
              <p className="text-sm text-zinc-500">
                Follow this account to see their photos, videos, and real-time updates.
              </p>
            </div>
          </div>
        ) : activeTab === 'posts' ? (
          posts.length === 0 ? (
            /* Empty Posts state */
            <div className="text-center py-20 text-zinc-500 font-semibold">
              No posts published yet.
            </div>
          ) : (
            /* 3-column posts list grid */
            <div className="grid grid-cols-3 gap-1 sm:gap-4">
              {posts.map((post) => (
                <div 
                  key={post.id}
                  className="aspect-square relative bg-zinc-150 dark:bg-zinc-800 overflow-hidden group rounded-lg shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 cursor-pointer"
                  onClick={() => router.push(`/posts/${post.id}`)}
                >
                  {post.media_urls && post.media_urls.length > 0 ? (
                    <img 
                      src={post.media_urls[0]} 
                      alt="Post Thumbnail" 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-850">
                      <p className="text-[11px] sm:text-sm text-zinc-650 leading-relaxed font-medium line-clamp-3">
                        {post.content}
                      </p>
                    </div>
                  )}

                  {/* Hover Overlay displaying statistics */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center space-x-4 sm:space-x-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white font-bold text-sm sm:text-base">
                    <div className="flex items-center space-x-1.5">
                      <Heart className="h-4 sm:h-5 sm:w-5 fill-white" />
                      <span>{post.likes_count || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <MessageCircle className="h-4 sm:h-5 sm:w-5 fill-white" />
                      <span>{post.comments_count || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Placeholder screens for other tabs */
          <div className="text-center py-20 text-zinc-500 font-semibold capitalize">
            {activeTab} content section placeholder.
          </div>
        )}
      </div>

      {/* Highlight Creator Modal */}
      <HighlightCreateModal
        isOpen={isCreateHighlightOpen}
        onClose={() => setIsCreateHighlightOpen(false)}
        onHighlightCreated={() => mutateHighlights()}
      />

      {/* Highlight Editor Modal */}
      {editHighlightTarget && (
        <HighlightEditModal
          isOpen={isEditHighlightOpen}
          onClose={() => {
            setIsEditHighlightOpen(false);
            setEditHighlightTarget(null);
          }}
          highlight={editHighlightTarget}
          onHighlightUpdated={() => mutateHighlights()}
        />
      )}

      {/* Highlight Viewer Overlay */}
      {activeHighlight && (
        <StoryViewer
          groups={[{
            author: profile,
            stories: activeHighlight.stories
          }]}
          initialGroupIndex={0}
          onClose={() => setActiveHighlight(null)}
          onStoryViewed={() => {}} // No-op
        />
      )}
    </div>
  );
}
