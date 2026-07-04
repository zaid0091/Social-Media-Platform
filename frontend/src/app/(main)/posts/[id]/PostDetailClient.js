'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  ChevronDown, 
  ChevronUp, 
  Smile, 
  X, 
  Send,
  MoreHorizontal,
  Trash2,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import CarouselComponent from '@/components/posts/CarouselComponent';
import VideoPlayer from '@/components/posts/VideoPlayer';

const fetcher = (url) => api.get(url).then((res) => res.data);

// Sub-component to manage nested comment replies dynamically
function RepliesList({ commentId, onReplyTo }) {
  const { data: repliesData, error } = useSWR(`/posts/comments/${commentId}/replies/`, fetcher);
  const replies = repliesData?.results || [];

  if (error) return <p className="text-xs text-red-500 pl-12 py-1">Failed to load replies.</p>;
  if (!repliesData) return <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin ml-12 my-2" />;

  return (
    <div className="pl-10 mt-2 space-y-3 border-l border-zinc-100 dark:border-zinc-800 ml-4">
      {replies.map((reply) => (
        <div key={reply.id} className="flex space-x-2 text-xs">
          {/* Reply avatar */}
          {reply.author.profile_picture ? (
            <img 
              src={reply.author.profile_picture} 
              alt={reply.author.username} 
              className="h-6 w-6 rounded-full object-cover border border-zinc-150 dark:border-zinc-850"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-[10px]">
              {reply.author.username?.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Reply body */}
          <div className="flex-1 min-w-0">
            <p className="text-zinc-850 dark:text-zinc-200">
              <Link href={`/${reply.author.username}`} className="font-extrabold hover:underline mr-1">
                {reply.author.username}
              </Link>
              {reply.content}
            </p>
            <div className="flex items-center space-x-3 text-zinc-500 mt-1">
              <span>{new Date(reply.created_at).toLocaleDateString()}</span>
              <button 
                onClick={() => onReplyTo(commentId, reply.author.username)}
                className="hover:underline font-bold cursor-pointer"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PostDetailClient({ id }) {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [commentText, setCommentText] = useState('');
  
  // Emoji Picker states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef(null);

  // Reply target parameters
  const [replyTarget, setReplyTarget] = useState(null); // { commentId, username }
  
  // Optimistic Like states
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [animateHeart, setAnimateHeart] = useState(false);

  // Collapsed replies mapping
  const [openReplies, setOpenReplies] = useState({}); // { commentId: boolean }

  const commentInputRef = useRef(null);

  // 1. Fetch Post Detail
  const { 
    data: post, 
    error: postError, 
    mutate: mutatePost 
  } = useSWR(id ? `/posts/${id}/` : null, fetcher);

  // 2. Fetch Comments
  const { 
    data: commentsData, 
    mutate: mutateComments 
  } = useSWR(id ? `/posts/${id}/comments/` : null, fetcher);

  // 3. Fetch Likers
  const { 
    data: likersData 
  } = useSWR(id ? `/posts/${id}/likers/` : null, fetcher);

  const comments = commentsData?.results || [];
  const likers = likersData?.results || [];

  // Sync state values on load
  useEffect(() => {
    if (post) {
      setIsLiked(post.is_liked);
      setLikeCount(post.like_count || 0);
      setIsBookmarked(post.is_bookmarked);
    }
  }, [post]);

  // Auto focus comment input on load
  useEffect(() => {
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [post]);

  // Click outside to auto-close emoji popup panel
  useEffect(() => {
    const clickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  if (postError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-lg font-bold">Post Not Found</h2>
        <p className="text-zinc-500 text-sm">This post may have been deleted or account visibility is restricted.</p>
        <button onClick={() => router.back()} className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold">Go Back</button>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-primary animate-spin" />
      </div>
    );
  }

  const handleLikeToggle = async () => {
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((prev) => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    if (!wasLiked) {
      setAnimateHeart(true);
      setTimeout(() => setAnimateHeart(false), 500);
    }

    try {
      await api.post(`/posts/like/${post.id}/`, { type: 'post' });
      mutatePost();
    } catch (err) {
      setIsLiked(wasLiked);
      setLikeCount((prev) => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleBookmarkToggle = async () => {
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);

    try {
      await api.post(`/posts/bookmark/${post.id}/`);
      mutatePost();
    } catch (err) {
      setIsBookmarked(wasBookmarked);
    }
  };

  // Submit Comments / Replies
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const payload = {
        post: post.id,
        content: replyTarget ? `@${replyTarget.username} ${commentText}` : commentText,
        parent: replyTarget ? replyTarget.commentId : null
      };

      await api.post(`/posts/${post.id}/comments/`, payload);
      setCommentText('');
      setReplyTarget(null);

      // Reload comments SWR cache
      mutateComments();
      mutatePost();

      // If reply, expand replies drawer
      if (payload.parent) {
        setOpenReplies((prev) => ({ ...prev, [payload.parent]: true }));
      }
    } catch (err) {}
  };

  const handleAddEmoji = (emoji) => {
    setCommentText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    commentInputRef.current.focus();
  };

  const toggleRepliesDrawer = (commentId) => {
    setOpenReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const handleReplyClick = (commentId, username) => {
    setReplyTarget({ commentId, username });
    commentInputRef.current.focus();
  };

  const getLikerSummaryString = () => {
    if (likeCount === 0) return 'Be the first to like this';
    if (likeCount === 1) return isLiked ? 'Liked by you' : `Liked by ${likers[0]?.username || '1 person'}`;
    
    const otherCount = likeCount - 1;
    const firstLiker = isLiked 
      ? (likers[0]?.username === currentUser?.username ? (likers[1]?.username || 'someone') : likers[0]?.username)
      : likers[0]?.username;
      
    return `Liked by ${firstLiker || 'someone'} and ${otherCount} other${otherCount > 1 ? 's' : ''}`;
  };

  const emojis = ['😃', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤔', '👍', '👎', '🔥', '👏', '🎉', '❤️', '💔'];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Detail view header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={() => router.back()} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 cursor-pointer">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Post</h1>
        </div>
      </header>

      {/* Main split presentation box container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-zinc-50/20 dark:bg-zinc-950/10">
        
        {/* Left Side: Media display panel */}
        <div className="lg:col-span-7 flex items-center justify-center bg-black min-h-[40vh] lg:min-h-0 border-r border-zinc-250 dark:border-zinc-800">
          {post.media && post.media.length > 0 ? (
            post.media.some(m => m.media_type === 'video') ? (
              <VideoPlayer src={post.media[0].media_url} poster={post.media[0].thumbnail_url} />
            ) : post.media.length > 1 ? (
              <CarouselComponent media={post.media} />
            ) : (
              <img src={post.media[0].media_url} alt="Attachment" className="max-w-full max-h-[80vh] object-contain" />
            )
          ) : (
            <div className="p-8 text-center text-zinc-400 font-semibold italic">Text post layout</div>
          )}
        </div>

        {/* Right Side: Comments and details scroll box (Instagram Style) */}
        <div className="lg:col-span-5 flex flex-col h-full bg-white dark:bg-zinc-900 max-h-[85vh]">
          {/* Header metadata details */}
          <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center space-x-3 shrink-0">
            {post.author.profile_picture ? (
              <img src={post.author.profile_picture} alt={post.author.username} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm">
                {post.author.username?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <Link href={`/${post.author.username}`} className="font-extrabold text-sm hover:underline truncate">
                {post.author.full_name || post.author.username}
              </Link>
              <span className="text-zinc-500 text-xs">@{post.author.username}</span>
            </div>
          </div>

          {/* Caption & Comments List scroll frame */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Caption description */}
            <div className="flex space-x-3 items-start border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
              {post.author.profile_picture ? (
                <img src={post.author.profile_picture} alt="Author" className="h-8 w-8 rounded-full object-cover shrink-0 mt-0.5" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs shrink-0 mt-0.5">
                  {post.author.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-sm">
                <Link href={`/${post.author.username}`} className="font-extrabold hover:underline mr-1.5">
                  {post.author.username}
                </Link>
                <span className="text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">{post.content}</span>
              </div>
            </div>

            {/* Comments Loop */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-center py-6 text-xs text-zinc-400 font-semibold">No comments yet. Write the first comment!</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex flex-col space-y-2">
                    <div className="flex space-x-3 items-start text-sm">
                      {comment.author.profile_picture ? (
                        <img src={comment.author.profile_picture} alt="Commenter" className="h-8 w-8 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs shrink-0 mt-0.5">
                          {comment.author.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-850 dark:text-zinc-200">
                          <Link href={`/${comment.author.username}`} className="font-extrabold hover:underline mr-1">
                            {comment.author.username}
                          </Link>
                          {comment.content}
                        </p>

                        <div className="flex items-center space-x-4 text-xs text-zinc-500 mt-1 font-medium">
                          <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                          <button 
                            onClick={() => handleReplyClick(comment.id, comment.author.username)}
                            className="hover:underline font-bold cursor-pointer"
                          >
                            Reply
                          </button>
                        </div>
                      </div>

                      {/* Comment Like toggle buttons */}
                      <button className="text-zinc-400 hover:text-red-500 cursor-pointer">
                        <Heart className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Collapsible Nested Replies panels */}
                    {comment.reply_count > 0 && (
                      <div className="pl-11">
                        <button
                          onClick={() => toggleRepliesDrawer(comment.id)}
                          className="flex items-center space-x-1.5 text-xs font-black text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350 cursor-pointer select-none"
                        >
                          {openReplies[comment.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          <span>
                            {openReplies[comment.id] ? 'Hide replies' : `View replies (${comment.reply_count})`}
                          </span>
                        </button>
                        
                        {openReplies[comment.id] && (
                          <RepliesList commentId={comment.id} onReplyTo={handleReplyClick} />
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Row & liked status widget */}
          <div className="p-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/10 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-zinc-500">
              <div className="flex space-x-4">
                <button onClick={handleLikeToggle} className="hover:text-red-500 transition-colors cursor-pointer">
                  <Heart className={`h-6 w-6 ${isLiked ? 'fill-red-500 text-red-500' : ''} ${animateHeart ? 'scale-125' : 'scale-100'} transition-transform`} />
                </button>
                <button onClick={() => commentInputRef.current.focus()} className="hover:text-primary transition-colors cursor-pointer">
                  <MessageCircle className="h-6 w-6" />
                </button>
                <button className="hover:text-primary transition-colors cursor-pointer">
                  <Share2 className="h-6 w-6" />
                </button>
              </div>
              
              <button onClick={handleBookmarkToggle} className="hover:text-primary transition-colors cursor-pointer">
                <Bookmark className={`h-6 w-6 ${isBookmarked ? 'fill-primary text-primary' : ''}`} />
              </button>
            </div>

            {/* Like counts & Liker details string */}
            <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 select-none">
              {getLikerSummaryString()}
            </p>
          </div>

          {/* Comments & replies sticky typing forms */}
          <div className="border-t border-zinc-150 dark:border-zinc-800 p-4 relative bg-white dark:bg-zinc-900 shrink-0">
            {/* Reply Target Header banner */}
            {replyTarget && (
              <div className="flex items-center justify-between px-3 py-1 bg-primary/5 rounded-lg mb-2 text-xs text-primary font-semibold select-none">
                <span>Replying to @{replyTarget.username}</span>
                <button onClick={() => setReplyTarget(null)} className="p-0.5 rounded-full hover:bg-primary/10 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Emoji popover grid */}
            {showEmojiPicker && (
              <div ref={emojiRef} className="absolute bottom-[72px] left-4 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-850 rounded-2xl shadow-xl p-3 grid grid-cols-8 gap-2 z-30">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleAddEmoji(emoji)}
                    className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center text-lg cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleCommentSubmit} className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 cursor-pointer"
                aria-label="Add Emoji"
              >
                <Smile className="h-5 w-5" />
              </button>
              
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={replyTarget ? "Write a reply..." : "Add a comment..."}
                className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all"
              />

              <button
                type="submit"
                disabled={!commentText.trim()}
                className="p-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:bg-primary text-white rounded-xl shadow-md transition-all cursor-pointer shrink-0"
                aria-label="Send Comment"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
