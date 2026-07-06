'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import CarouselComponent from '@/components/posts/CarouselComponent';
import VideoPlayer from '@/components/posts/VideoPlayer';
import CommentItem from '@/components/posts/CommentItem';
import CommentInput from '@/components/posts/CommentInput';
import RepostCard from '@/components/posts/RepostCard';
import { parseContent } from '@/utils/parseContent';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function PostDetailClient({ id }) {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  
  // Input tracking states
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null); // { commentId, username }

  // Comments lists states
  const [comments, setComments] = useState([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [hasNextComments, setHasNextComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // Optimistic Post Like states
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [animateHeart, setAnimateHeart] = useState(false);

  // 1. Fetch Post Detail
  const { 
    data: post, 
    mutate: mutatePost 
  } = useSWR(id ? `/posts/${id}/` : null, fetcher);

  // 2. Fetch Likers list details
  const { 
    data: likersData 
  } = useSWR(id ? `/posts/${id}/likers/` : null, fetcher);
  const likers = likersData?.results || [];

  // Sync post properties on load
  useEffect(() => {
    if (post) {
      setIsLiked(post.is_liked);
      setLikeCount(post.like_count || 0);
      setIsBookmarked(post.is_bookmarked);
    }
  }, [post]);

  // Fetch comments page-by-page
  const fetchComments = async (pageNumber, isRefresh = false) => {
    if (!id) return;
    setLoadingComments(true);
    try {
      const res = await api.get(`/posts/${id}/comments/?page=${pageNumber}`);
      const results = res.data.results || [];
      setComments((prev) => isRefresh ? results : [...prev, ...results]);
      setHasNextComments(!!res.data.next);
    } catch (err) {
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    setCommentsPage(1);
    fetchComments(1, true);
  }, [id]);

  const handleLoadMoreComments = () => {
    const nextPage = commentsPage + 1;
    setCommentsPage(nextPage);
    fetchComments(nextPage, false);
  };

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

  // Submit new top-level comment or reply with Optimistic rendering
  const handleCommentSubmit = async (text) => {
    if (submitting) return;
    setSubmitting(true);

    const tempId = 'temp-' + Date.now();
    const tempComment = {
      id: tempId,
      content: replyTarget ? `@${replyTarget.username} ${text}` : text,
      author: currentUser || { username: 'you' },
      created_at: new Date().toISOString(),
      like_count: 0,
      reply_count: 0,
      is_liked: false,
      parent: replyTarget ? replyTarget.commentId : null
    };

    // Optimistic UI updates
    if (!tempComment.parent) {
      // Prepend to top-level comments list
      setComments((prev) => [tempComment, ...prev]);
    } else {
      // Update parent comment reply counter in the list
      setComments((prev) => prev.map(c => 
        c.id === tempComment.parent ? { ...c, reply_count: c.reply_count + 1 } : c
      ));
    }

    try {
      const payload = {
        post: post.id,
        content: tempComment.content,
        parent: tempComment.parent
      };
      
      await api.post(`/posts/${post.id}/comments/`, payload);
      setCommentText('');
      setReplyTarget(null);
      
      // Refresh backend list
      fetchComments(1, true);
      mutatePost();
    } catch (err) {
      // Revert optimistic updates on error
      if (!tempComment.parent) {
        setComments((prev) => prev.filter(c => c.id !== tempId));
      } else {
        setComments((prev) => prev.map(c => 
          c.id === tempComment.parent ? { ...c, reply_count: Math.max(0, c.reply_count - 1) } : c
        ));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentDelete = (deletedId) => {
    setComments((prev) => prev.filter(c => c.id !== deletedId));
    mutatePost();
  };

  const handleCommentEdit = (editedId, newContent) => {
    setComments((prev) => prev.map(c => 
      c.id === editedId ? { ...c, content: newContent } : c
    ));
    mutatePost();
  };

  const handleReplyClick = (commentId, username) => {
    setReplyTarget({ commentId, username });
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

  if (!post) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Header Row */}
      <header className="sticky top-0 z-10 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl border-b border-zinc-150 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={() => router.back()} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 cursor-pointer">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Post</h1>
        </div>
      </header>

      {/* 2. Main split box container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-zinc-50/20 dark:bg-zinc-950/10">
        
        {/* Left media block */}
        <div className="lg:col-span-7 flex items-center justify-center bg-black min-h-[40vh] lg:min-h-0 border-r border-zinc-250 dark:border-zinc-800">
          {(() => {
            const displayMedia = post.media && post.media.length > 0 
              ? post.media 
              : post.repost_of?.media;

            if (displayMedia && displayMedia.length > 0) {
              if (displayMedia.some(m => m.media_type === 'video')) {
                return <VideoPlayer src={displayMedia[0].media_url} poster={displayMedia[0].thumbnail_url} />;
              } else if (displayMedia.length > 1) {
                return <CarouselComponent media={displayMedia} />;
              } else {
                return <img src={displayMedia[0].media_url} alt="Attachment" className="max-w-full max-h-[80vh] object-contain" />;
              }
            }
            return <div className="p-8 text-center text-zinc-400 font-semibold italic select-none">Text post layout</div>;
          })()}
        </div>

        {/* Right scrolling Comments & caption bar */}
        <div className="lg:col-span-5 flex flex-col h-full bg-white dark:bg-zinc-900 max-h-[85vh]">
          {/* Header author details */}
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

          {/* Comments list scrolling box */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Caption */}
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
                <span className="text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">{parseContent(post.content)}</span>
                {post.repost_of && (
                  <div className="mt-2 w-full max-w-md">
                    <RepostCard post={post.repost_of} />
                  </div>
                )}
              </div>
            </div>

            {/* Render comments list */}
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentItem 
                  key={comment.id}
                  comment={comment}
                  onReply={handleReplyClick}
                  onDelete={handleCommentDelete}
                  onEdit={handleCommentEdit}
                />
              ))}

              {/* Load More Pagination controls */}
              {hasNextComments && (
                <div className="pt-2 text-center">
                  <button
                    onClick={handleLoadMoreComments}
                    disabled={loadingComments}
                    className="inline-flex items-center space-x-1 px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-full text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350 bg-zinc-50/50 dark:bg-zinc-950/20 hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    {loadingComments ? (
                      <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-primary animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span>Load more comments</span>
                  </button>
                </div>
              )}

              {comments.length === 0 && !loadingComments && (
                <p className="text-center py-6 text-xs text-zinc-400 font-semibold select-none">No comments yet. Write the first comment!</p>
              )}
            </div>
          </div>

          {/* Action Row panel */}
          <div className="p-4 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/10 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-zinc-500">
              <div className="flex space-x-4">
                <button onClick={handleLikeToggle} className="hover:text-red-500 transition-colors cursor-pointer">
                  <Heart className={`h-6 w-6 ${isLiked ? 'fill-red-500 text-red-500' : ''} ${animateHeart ? 'scale-125' : 'scale-100'} transition-transform`} />
                </button>
                <button className="hover:text-primary transition-colors cursor-pointer">
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

            {/* Like count summary */}
            <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 select-none">
              {getLikerSummaryString()}
            </p>
          </div>

          {/* Comment composition footer typing inputs */}
          <CommentInput
            user={currentUser}
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
            onSubmit={handleCommentSubmit}
            commentText={commentText}
            setCommentText={setCommentText}
            submitting={submitting}
          />
        </div>
      </div>
    </div>
  );
}
