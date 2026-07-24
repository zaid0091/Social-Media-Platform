'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import useUserProfile from '@/hooks/useUserProfile';
import useUserPosts from '@/hooks/useUserPosts';
import FollowButton from '@/components/profile/FollowButton';
import ProfileSkeleton from '@/components/ui/ProfileSkeleton';
import HighlightCreateModal from '@/components/stories/HighlightCreateModal';
import HighlightEditModal from '@/components/stories/HighlightEditModal';
import dynamic from 'next/dynamic';

const StoryViewer = dynamic(() => import('@/components/stories/StoryViewer'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-55 bg-black/90 flex items-center justify-center text-white font-semibold">Loading highlight...</div>
});
import LazyViewportImage from '@/components/ui/LazyViewportImage';
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
  Settings,
  MoreHorizontal,
  ShieldAlert,
  AlertTriangle,
  Check
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ReportModal from '@/components/moderation/ReportModal';

export default function ProfilePage() {
  const { username } = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('posts');

  // 1. Fetch public profile details using useUserProfile
  const { 
    data: profile, 
    error: profileError, 
    refetch: mutateProfile 
  } = useUserProfile(username);

  // Auto-redirect /profile to /[username] when currentUser is loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && username === 'profile' && currentUser?.username) {
      router.replace(`/${currentUser.username}`);
    }
  }, [username, currentUser, router]);

  // 2. Fetch profile posts using useUserPosts
  const { 
    data: postsData, 
    error: postsError 
  } = useUserPosts(profile?.id, {
    enabled: !!(profile?.is_accessible && profile?.id)
  });

  const posts = postsData?.results || [];

  const [isCreateHighlightOpen, setIsCreateHighlightOpen] = useState(false);
  const [isEditHighlightOpen, setIsEditHighlightOpen] = useState(false);
  const [editHighlightTarget, setEditHighlightTarget] = useState(null);
  const [activeHighlight, setActiveHighlight] = useState(null);

  // 2b. Fetch user highlights using React Query
  const { 
    data: highlights = [], 
    refetch: mutateHighlights 
  } = useQuery({
    queryKey: ['highlights', profile?.username],
    queryFn: () => api.get(`/stories/highlights/user/${profile.username}/`).then((res) => res.data),
    enabled: !!(profile?.is_accessible && profile?.username)
  });

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [isRestrictConfirmOpen, setIsRestrictConfirmOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [toast, setToast] = useState(null);

  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleBlockToggle = async () => {
    setLoadingAction(true);
    try {
      if (profile.is_blocked) {
        await api.post(`/users/unblock/${profile.id}/`);
        mutateProfile({
          ...profile,
          is_blocked: false,
          is_accessible: !profile.is_private || profile.is_following
        }, { revalidate: true });
        setToast('User unblocked');
      } else {
        await api.post(`/users/block/${profile.id}/`);
        mutateProfile({
          ...profile,
          is_blocked: true,
          is_accessible: false,
          is_following: false,
          follow_request_pending: false
        }, { revalidate: true });
        setToast('User blocked');
      }
      setIsBlockConfirmOpen(false);
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setToast(err.response?.data?.error || 'Action failed');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUnblockProfile = async () => {
    setLoadingAction(true);
    try {
      await api.post(`/users/unblock/${profile.id}/`);
      mutateProfile({
        ...profile,
        is_blocked: false,
        is_accessible: !profile.is_private || profile.is_following
      }, { revalidate: true });
      setToast('User unblocked');
      setTimeout(() => setToast(null), 2550);
    } catch (err) {
      setToast('Failed to unblock user');
      setTimeout(() => setToast(null), 2550);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRestrictToggle = async () => {
    setLoadingAction(true);
    try {
      if (profile.is_restricted) {
        await api.post(`/users/unrestrict/${profile.id}/`);
        mutateProfile({
          ...profile,
          is_restricted: false
        }, { revalidate: true });
        setToast('User unrestricted');
      } else {
        await api.post(`/users/restrict/${profile.id}/`);
        mutateProfile({
          ...profile,
          is_restricted: true
        }, { revalidate: true });
        setToast('User restricted');
      }
      setIsRestrictConfirmOpen(false);
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setToast(err.response?.data?.error || 'Action failed');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoadingAction(false);
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
    return <ProfileSkeleton />;
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
                  className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-655 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  aria-label="Send Message"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>

                <FollowButton
                  userId={profile.id}
                  username={profile.username}
                  initialIsFollowing={profile.is_following}
                  initialFollowRequestPending={profile.follow_request_pending}
                  isPrivate={profile.is_private}
                  onStateChange={(newFollowing, newPending) => {
                    mutateProfile({
                      ...profile,
                      is_following: newFollowing,
                      follow_request_pending: newPending,
                      follower_count: newFollowing 
                        ? (profile.is_following ? profile.follower_count : profile.follower_count + 1)
                        : (profile.is_following ? Math.max(0, profile.follower_count - 1) : profile.follower_count)
                    }, { revalidate: true });
                  }}
                  className="!px-4 !py-2 text-sm"
                />

                {/* Profile Options dropdown */}
                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-655 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none"
                    aria-label="More Options"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-25 py-1 text-sm font-semibold overflow-hidden text-left">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsReportOpen(true);
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-amber-550 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <span>Report User</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsRestrictConfirmOpen(true);
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <ShieldAlert className="h-4 w-4 text-orange-400" />
                        <span>{profile.is_restricted ? 'Unrestrict User' : 'Restrict User'}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBlockConfirmOpen(true);
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer"
                      >
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span>{profile.is_blocked ? 'Unblock User' : 'Block User'}</span>
                      </button>
                    </div>
                  )}
                </div>
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
          {profile.is_accessible ? (
            <Link href={`/${profile.username}/following`} className="flex items-center space-x-1 text-[15px] hover:underline cursor-pointer">
              <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{profile.following_count || 0}</span>
              <span className="text-zinc-500 font-medium">Following</span>
            </Link>
          ) : (
            <div className="flex items-center space-x-1 text-[15px]">
              <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{profile.following_count || 0}</span>
              <span className="text-zinc-500 font-medium">Following</span>
            </div>
          )}

          {profile.is_accessible ? (
            <Link href={`/${profile.username}/followers`} className="flex items-center space-x-1 text-[15px] hover:underline cursor-pointer">
              <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{profile.follower_count || 0}</span>
              <span className="text-zinc-500 font-medium">Followers</span>
            </Link>
          ) : (
            <div className="flex items-center space-x-1 text-[15px]">
              <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{profile.follower_count || 0}</span>
              <span className="text-zinc-500 font-medium">Followers</span>
            </div>
          )}

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
        {profile.is_blocked ? (
          /* Blocked Profile Locked Card */
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-16 w-16 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center border border-red-100 dark:border-red-900/50 text-red-500">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div className="flex flex-col space-y-1.5 max-w-sm">
              <h3 className="font-extrabold text-lg text-red-500">You Blocked This User</h3>
              <p className="text-sm text-zinc-500 font-semibold leading-relaxed">
                You blocked @{profile.username}. Unblock them to view their posts, photos, and updates.
              </p>
              <button
                onClick={handleUnblockProfile}
                className="mt-4 px-4 py-2 bg-primary hover:bg-primary-hover text-xs font-black text-white rounded-xl shadow-sm transition cursor-pointer select-none"
              >
                Unblock User
              </button>
            </div>
          </div>
        ) : !profile.is_accessible ? (
          /* Private Profile Locked Card */
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-850 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Lock className="h-7 w-7" />
            </div>
            <div className="flex flex-col space-y-1.5 max-w-sm">
              <h3 className="font-extrabold text-lg">This Account is Private</h3>
              <p className="text-sm text-zinc-500 font-semibold">
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
              {posts.map((post) => {
                const displayMedia = post.media && post.media.length > 0 
                  ? post.media 
                  : post.repost_of?.media;
                const hasMedia = displayMedia && displayMedia.length > 0;
                const displayText = post.content || post.repost_of?.content || '';

                return (
                  <div 
                    key={post.id}
                    className="aspect-square relative bg-zinc-150 dark:bg-zinc-800 overflow-hidden group rounded-lg shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 cursor-pointer"
                    onClick={() => router.push(`/posts/${post.id}`)}
                  >
                    {hasMedia ? (
                      <LazyViewportImage 
                        src={displayMedia[0].media_url} 
                        alt="Post Thumbnail" 
                        blurHash={displayMedia[0].blur_hash}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-zinc-50 to-zinc-150 dark:from-zinc-900 dark:to-zinc-850">
                        <p className="text-[10px] sm:text-[11px] text-zinc-600 dark:text-zinc-405 leading-normal font-semibold line-clamp-4 select-none">
                          {displayText}
                        </p>
                      </div>
                    )}

                    {/* Hover Overlay displaying statistics */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center space-x-4 sm:space-x-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white font-bold text-sm sm:text-base">
                      <div className="flex items-center space-x-1.5">
                        <Heart className="h-4 sm:h-5 sm:w-5 fill-white" />
                        <span>{post.like_count ?? post.likes_count ?? 0}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <MessageCircle className="h-4 sm:h-5 sm:w-5 fill-white" />
                        <span>{post.comment_count ?? post.comments_count ?? 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {/* Toast Alert overlay */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-55 px-3 py-2.5 bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md animate-in slide-in-from-bottom-5 duration-200">
          <Check className="h-4 w-4 text-emerald-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* Report User Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="user"
        targetId={profile.id}
      />

      {/* Block Confirm Dialog */}
      <ConfirmDialog
        isOpen={isBlockConfirmOpen}
        title={profile.is_blocked ? "Unblock User?" : "Block User?"}
        message={
          profile.is_blocked 
            ? `Are you sure you want to unblock @${profile.username}? They will be able to see your posts and send follow requests.`
            : `Are you sure you want to block @${profile.username}? They won't be able to see your profile or posts, and any mutual follow connections will be removed.`
        }
        confirmLabel={profile.is_blocked ? "Unblock" : "Block"}
        cancelLabel="Cancel"
        isDangerous={!profile.is_blocked}
        isLoading={loadingAction}
        onConfirm={handleBlockToggle}
        onCancel={() => setIsBlockConfirmOpen(false)}
      />

      {/* Restrict Confirm Dialog */}
      <ConfirmDialog
        isOpen={isRestrictConfirmOpen}
        title={profile.is_restricted ? "Unrestrict User?" : "Restrict User?"}
        message={
          profile.is_restricted 
            ? `Are you sure you want to unrestrict @${profile.username}? Their new comments will immediately be visible to all users.`
            : `Are you sure you want to restrict @${profile.username}? Their new comments on your posts will only be visible to them, and they won't see when you're online.`
        }
        confirmLabel={profile.is_restricted ? "Unrestrict" : "Restrict"}
        cancelLabel="Cancel"
        isDangerous={false}
        isLoading={loadingAction}
        onConfirm={handleRestrictToggle}
        onCancel={() => setIsRestrictConfirmOpen(false)}
      />
    </div>
  );
}
