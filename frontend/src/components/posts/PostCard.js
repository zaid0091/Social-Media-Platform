'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseContent } from '@/utils/parseContent';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  MoreHorizontal, 
  Trash2, 
  EyeOff, 
  AlertTriangle,
  Link as LinkIcon,
  Check,
  X,
  Repeat2
} from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import CarouselComponent from './CarouselComponent';
import VideoPlayer from './VideoPlayer';
import BookmarkActionMenu from './BookmarkActionMenu';
import RepostCard from './RepostCard';
import QuotePostModal from './QuotePostModal';
import ShareModal from './ShareModal';

// Helper to format timestamps to relative time
const getRelativeTime = (dateString) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
};

export default function PostCard({ post, onDelete }) {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();

  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked);
  const [isReposted, setIsReposted] = useState(post.is_reposted);
  const [repostCount, setRepostCount] = useState(post.repost_count || 0);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBookmarkMenuOpen, setIsBookmarkMenuOpen] = useState(false);
  const [isRepostMenuOpen, setIsRepostMenuOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [animateHeart, setAnimateHeart] = useState(false);
  const [toast, setToast] = useState(null);

  const menuRef = useRef(null);
  const bookmarkRef = useRef(null);
  const repostRef = useRef(null);

  // Sync state if props change
  useEffect(() => {
    setIsLiked(post.is_liked);
    setLikeCount(post.like_count || 0);
    setIsBookmarked(post.is_bookmarked);
    setIsReposted(post.is_reposted);
    setRepostCount(post.repost_count || 0);
  }, [post]);

  // Click outside listener to auto-close options dropdown, bookmark menu, and repost menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
      if (bookmarkRef.current && !bookmarkRef.current.contains(e.target)) {
        setIsBookmarkMenuOpen(false);
      }
      if (repostRef.current && !repostRef.current.contains(e.target)) {
        setIsRepostMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isHidden) return null;

  const isLongContent = post.content?.length > 280;
  const renderedContent = isExpanded 
    ? post.content 
    : post.content?.slice(0, 280);

  // Optimistic Like toggles
  const handleLikeToggle = async (e) => {
    e.stopPropagation();
    const wasLiked = isLiked;
    
    // Optimistic cache states
    setIsLiked(!wasLiked);
    setLikeCount((prev) => wasLiked ? Math.max(0, prev - 1) : prev + 1);
    if (!wasLiked) {
      setAnimateHeart(true);
      setTimeout(() => setAnimateHeart(false), 500);
    }

    try {
      await api.post(`/posts/like/${post.id}/`, { type: 'post' });
    } catch (err) {
      // Revert on failure
      setIsLiked(wasLiked);
      setLikeCount((prev) => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  // Optimistic Bookmark toggles
  const handleBookmarkClick = async (e) => {
    if (e) e.stopPropagation();
    const wasBookmarked = isBookmarked;

    if (!wasBookmarked) {
      setIsBookmarked(true);
      try {
        await api.post(`/posts/bookmark/${post.id}/`);
        setIsBookmarkMenuOpen(true);
      } catch (err) {
        setIsBookmarked(false);
      }
    } else {
      setIsBookmarkMenuOpen(!isBookmarkMenuOpen);
    }
  };

  const handleConfirmRemove = async () => {
    setIsConfirmOpen(false);
    setIsBookmarked(false);
    setIsBookmarkMenuOpen(false);
    try {
      await api.post(`/posts/bookmark/${post.id}/`);
      setToast('Removed from bookmarks');
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setIsBookmarked(true);
    }
  };

  const handleShare = (e) => {
    if (e) e.stopPropagation();
    setIsShareOpen(true);
  };

  const handleRepostToggle = async (e) => {
    if (e) e.stopPropagation();
    setIsRepostMenuOpen(false);
    const wasReposted = isReposted;
    
    setIsReposted(!wasReposted);
    setRepostCount((prev) => wasReposted ? Math.max(0, prev - 1) : prev + 1);

    try {
      await api.post(`/posts/${post.id}/repost/`);
      setToast(wasReposted ? 'Repost removed' : 'Reposted successfully!');
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setIsReposted(wasReposted);
      setRepostCount((prev) => wasReposted ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleDeletePost = async () => {
    setIsMenuOpen(false);
    try {
      await api.delete(`/posts/${post.id}/delete/`);
      if (onDelete) {
        onDelete(post.id);
      } else {
        setIsHidden(true);
      }
    } catch (err) {
      setToast('Failed to delete post.');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const isOwnPost = currentUser && post.author.id === currentUser.id;

  return (
    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800/80 w-full relative flex flex-col">
      {/* Repost attribution header */}
      {post.post_type === 'repost' && (
        <div className="flex items-center space-x-1.5 px-4 pt-3 text-[10px] font-black text-zinc-400 dark:text-zinc-550 uppercase tracking-wider select-none">
          <Repeat2 className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span>{post.author?.full_name || post.author?.username} Reposted</span>
        </div>
      )}

      {/* Toast Alert popup overlay */}
      {toast && (
        <div className="absolute top-4 right-4 z-20 px-3 py-2 bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md">
          <Check className="h-4 w-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* 1. Profile Header Row */}
      <div className="px-4 pt-4 pb-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href={`/${post.author.username}`} className="shrink-0 block select-none">
            {post.author.profile_picture ? (
              <img 
                src={post.author.profile_picture} 
                alt={post.author.username} 
                className="h-10 w-10 rounded-full object-cover border border-zinc-200/50 dark:border-zinc-800/50"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm">
                {post.author.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          
          <div className="flex flex-col min-w-0">
            <Link 
              href={`/${post.author.username}`}
              className="font-extrabold text-sm text-zinc-900 dark:text-zinc-50 hover:underline leading-tight truncate max-w-[150px]"
            >
              {post.author.full_name || post.author.username}
            </Link>
            <div className="flex items-center space-x-1 text-zinc-500 text-xs font-medium mt-0.5">
              <span>@{post.author.username}</span>
              <span>•</span>
              <span className="truncate">{getRelativeTime(post.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Options Menu dropdown */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 cursor-pointer"
            aria-label="Options Menu"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-25 py-1 text-sm font-semibold overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  if (isBookmarked) {
                    setIsConfirmOpen(true);
                  } else {
                    handleBookmarkClick();
                  }
                }}
                className="w-full text-left px-4 py-2.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer border-b border-zinc-100 dark:border-zinc-800"
              >
                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-primary text-primary' : ''}`} />
                <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark'}</span>
              </button>

              {isOwnPost ? (
                <button
                  onClick={handleDeletePost}
                  className="w-full text-left px-4 py-2.5 text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Post</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsHidden(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer"
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>Hide Post</span>
                  </button>
                  <button
                    onClick={() => {
                      setToast('Report submitted. Thank you.');
                      setIsMenuOpen(false);
                      setTimeout(() => setToast(null), 2500);
                    }}
                    className="w-full text-left px-4 py-2.5 text-amber-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 cursor-pointer"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Report Post</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Post content text details */}
      {post.content && (
        <div className="px-4 pb-2.5 text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-150 whitespace-pre-wrap">
          {parseContent(renderedContent)}
          {isLongContent && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-primary hover:underline font-bold text-sm ml-1 cursor-pointer block mt-1"
            >
              {isExpanded ? 'See less' : 'See more'}
            </button>
          )}
        </div>
      )}

      {/* 3. Media Panel wrapper */}
      {post.media && post.media.length > 0 && (
        <div className="w-full overflow-hidden border-y border-zinc-150 dark:border-zinc-800 bg-zinc-950/20">
          {/* Check if video posts exist */}
          {post.media.some(m => m.media_type === 'video') ? (
            <VideoPlayer 
              src={post.media[0].media_url} 
              poster={post.media[0].thumbnail_url} 
            />
          ) : post.media.length > 1 ? (
            <CarouselComponent media={post.media} />
          ) : (
            <div 
              className="w-full relative aspect-square bg-zinc-955 flex items-center justify-center cursor-pointer"
              onClick={() => router.push(`/posts/${post.id}`)}
            >
              <img 
                src={post.media[0].media_url} 
                alt="Post Attachment" 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Nested original post preview for reposts/quotes */}
      {post.repost_of && (
        <div className="px-4 pb-3">
          <RepostCard post={post.repost_of} />
        </div>
      )}

      {/* 4. Action Row panel */}
      <div className="px-4 py-3 flex items-center justify-between border-t border-transparent">
        <div className="flex items-center space-x-6 text-zinc-500">
          {/* Like controls with optimistic counters and scale animations */}
          <button 
            onClick={handleLikeToggle}
            className={`flex items-center space-x-1.5 hover:text-red-500 transition-colors cursor-pointer select-none ${
              isLiked ? 'text-red-500' : ''
            }`}
            aria-label="Like Post"
          >
            <Heart 
              className={`h-5 w-5 transition-transform ${
                isLiked ? 'fill-red-500 text-red-500' : ''
              } ${animateHeart ? 'scale-125' : 'scale-100'}`} 
            />
            <span className="text-sm font-semibold">{likeCount}</span>
          </button>

          {/* Comment button */}
          <button 
            onClick={() => router.push(`/posts/${post.id}`)}
            className="flex items-center space-x-1.5 hover:text-primary transition-colors cursor-pointer select-none"
            aria-label="Comment on Post"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">{post.comment_count || 0}</span>
          </button>

          {/* Repost button with dropdown popup */}
          <div className="relative" ref={repostRef}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsRepostMenuOpen(!isRepostMenuOpen);
              }}
              className={`flex items-center space-x-1.5 hover:text-emerald-500 transition-colors cursor-pointer select-none ${
                isReposted ? 'text-emerald-500' : ''
              }`}
              aria-label="Repost options"
            >
              <Repeat2 className={`h-5 w-5 ${isReposted ? 'text-emerald-500 font-bold' : ''}`} />
              <span className="text-sm font-semibold">{repostCount}</span>
            </button>

            {isRepostMenuOpen && (
              <div className="absolute left-0 mt-1 w-32 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-25 py-1 text-xs font-bold overflow-hidden">
                <button
                  onClick={handleRepostToggle}
                  className="w-full text-left px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 text-zinc-700 dark:text-zinc-200 cursor-pointer"
                >
                  <Repeat2 className="h-3.5 w-3.5" />
                  <span>{isReposted ? 'Undo Repost' : 'Repost'}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRepostMenuOpen(false);
                    setIsQuoteOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-2 text-zinc-700 dark:text-zinc-200 cursor-pointer"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Quote Post</span>
                </button>
              </div>
            )}
          </div>

          {/* Share button */}
          <button 
            onClick={handleShare}
            className="flex items-center space-x-1.5 hover:text-primary transition-colors cursor-pointer select-none"
            aria-label="Share Post"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {/* Bookmark controls with Collections popover wrapper */}
        <div className="relative" ref={bookmarkRef}>
          <button 
            onClick={handleBookmarkClick}
            className={`flex items-center hover:text-primary transition-colors cursor-pointer select-none ${
              isBookmarked ? 'text-primary' : 'text-zinc-500'
            }`}
            aria-label="Bookmark Post"
          >
            <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-primary text-primary' : ''}`} />
          </button>

          {isBookmarkMenuOpen && (
            <BookmarkActionMenu
              post={{ ...post, is_bookmarked: isBookmarked }}
              onClose={() => setIsBookmarkMenuOpen(false)}
              onBookmarkToggle={(val) => setIsBookmarked(val)}
              onRemoveConfirm={(e) => {
                e.stopPropagation();
                setIsConfirmOpen(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Remove Bookmark Confirmation Modal overlay */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xs rounded-2.5xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 text-center flex flex-col items-center">
            <Bookmark className="h-10 w-10 text-red-500 mb-3 animate-bounce" />
            <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Remove Bookmark?</h4>
            <p className="text-[10px] text-zinc-400 font-semibold mt-1.5 leading-relaxed">
              This post will be removed from your saved bookmarks and any collection folders it belongs to.
            </p>
            <div className="flex w-full space-x-3 mt-4">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-[10px] font-black text-zinc-500 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-650 text-[10px] font-black text-white shadow-md transition cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal overlay */}
      <ShareModal
        isOpen={isShareOpen}
        post={post}
        onClose={() => setIsShareOpen(false)}
      />

      {/* Quote Post Modal overlay */}
      <QuotePostModal
        isOpen={isQuoteOpen}
        post={post}
        onClose={() => setIsQuoteOpen(false)}
        onSuccess={(newQuote) => {
          setRepostCount((prev) => prev + 1);
          setToast('Quote posted successfully!');
          setTimeout(() => setToast(null), 2500);
        }}
      />
    </div>
  );
}
