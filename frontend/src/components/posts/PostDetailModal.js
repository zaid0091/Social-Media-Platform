'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { 
  X, Heart, MessageCircle, Share2, Bookmark, ChevronDown, UserPlus, UserCheck 
} from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import CarouselComponent from '@/components/posts/CarouselComponent';
import VideoPlayer from '@/components/posts/VideoPlayer';
import CommentItem from '@/components/posts/CommentItem';
import CommentInput from '@/components/posts/CommentInput';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function PostDetailModal({ postId, isOpen, onClose }) {
  const { user: currentUser } = useAuthStore();
  
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null); // { commentId, username }
  
  const [comments, setComments] = useState([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [hasNextComments, setHasNextComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [animateHeart, setAnimateHeart] = useState(false);
  
  const [authorIsFollowing, setAuthorIsFollowing] = useState(false);
  const [authorFollowPending, setAuthorFollowPending] = useState(false);

  // 1. Fetch Post details
  const { data: post, mutate: mutatePost } = useSWR(
    isOpen && postId ? `/posts/${postId}/` : null, 
    fetcher
  );

  // 2. Sync likes & follows on load
  useEffect(() => {
    if (post) {
      setIsLiked(post.is_liked);
      setLikeCount(post.like_count || 0);
      setIsBookmarked(post.is_bookmarked);
      setAuthorIsFollowing(post.author?.is_following || false);
      setAuthorFollowPending(post.author?.follow_request_pending || false);
    }
  }, [post]);

  // 3. Fetch Comments
  const fetchComments = async (pageNumber, isRefresh = false) => {
    if (!postId) return;
    setLoadingComments(true);
    try {
      const res = await api.get(`/posts/${postId}/comments/?page=${pageNumber}`);
      const results = res.data.results || [];
      setComments((prev) => isRefresh ? results : [...prev, ...results]);
      setHasNextComments(!!res.data.next);
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (isOpen && postId) {
      setCommentsPage(1);
      fetchComments(1, true);
    } else {
      setComments([]);
    }
  }, [isOpen, postId]);

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
      await api.post(`/posts/like/${postId}/`);
      mutatePost();
    } catch (err) {
      // Revert on error
      setIsLiked(wasLiked);
      setLikeCount((prev) => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleBookmarkToggle = async () => {
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);

    try {
      await api.post(`/posts/bookmark/${postId}/`);
      mutatePost();
    } catch (err) {
      setIsBookmarked(wasBookmarked);
    }
  };

  const handleFollowToggle = async () => {
    if (!post?.author) return;
    const authorUsername = post.author.username;
    const wasFollowing = authorIsFollowing;
    const isPrivate = post.author.is_private;

    if (wasFollowing) {
      setAuthorIsFollowing(false);
    } else if (isPrivate) {
      setAuthorFollowPending(true);
    } else {
      setAuthorIsFollowing(true);
    }

    try {
      if (wasFollowing) {
        await api.post(`/users/unfollow/${post.author.id}/`);
      } else {
        await api.post(`/users/follow/${post.author.id}/`);
      }
      mutatePost();
    } catch (err) {
      // Revert on error
      setAuthorIsFollowing(wasFollowing);
      setAuthorFollowPending(post.author.follow_request_pending);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const payload = { content: commentText.trim() };
      if (replyTarget) {
        payload.parent_id = replyTarget.commentId;
      }

      await api.post(`/posts/${postId}/comments/`, payload);
      setCommentText('');
      setReplyTarget(null);
      // Reload comments list from beginning
      setCommentsPage(1);
      fetchComments(1, true);
      mutatePost();
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyTo = (commentId, username) => {
    setReplyTarget({ commentId, username });
    setCommentText(`@${username} `);
  };

  const handleCommentDelete = () => {
    setCommentsPage(1);
    fetchComments(1, true);
    mutatePost();
  };

  if (!isOpen) return null;

  const mediaList = post?.media || [];
  const hasMedia = mediaList.length > 0;
  const isVideo = hasMedia && mediaList[0].media_type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      
      {/* MODAL MAIN BOX */}
      <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative animate-scale-up">
        
        {/* CLOSE BUTTON */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-55 p-2 bg-black/50 hover:bg-black/85 text-white rounded-full transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* LEFT COLUMN: Media Content */}
        <div className="w-full md:w-[58%] h-[35vh] md:h-full bg-zinc-950 flex items-center justify-center relative shrink-0">
          {!post ? (
            <div className="h-10 w-10 rounded-full border-4 border-zinc-800 border-t-primary animate-spin" />
          ) : hasMedia ? (
            isVideo ? (
              <div className="w-full h-full">
                <VideoPlayer url={mediaList[0].media_url} />
              </div>
            ) : mediaList.length > 1 ? (
              <div className="w-full h-full">
                <CarouselComponent media={mediaList} />
              </div>
            ) : (
              <img src={mediaList[0].media_url} alt="Post Media" className="w-full h-full object-contain" />
            )
          ) : (
            <div className="p-6 text-center text-zinc-350 max-h-full overflow-y-auto max-w-lg scrollbar-none font-medium leading-relaxed whitespace-pre-wrap select-text">
              {post.content}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Info & Comments List */}
        <div className="flex-1 flex flex-col h-[50vh] md:h-full bg-white dark:bg-zinc-900 overflow-hidden text-left divide-y divide-zinc-100 dark:divide-zinc-850">
          
          {/* 1. Header author details */}
          {post && (
            <div className="p-4 flex items-center justify-between">
              <Link href={`/${post.author?.username}`} className="flex items-center space-x-3 min-w-0" onClick={onClose}>
                <img 
                  src={post.author?.profile_picture || '/default-avatar.png'} 
                  alt={post.author?.username} 
                  className="h-9 w-9 rounded-full object-cover shrink-0" 
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 leading-tight">
                    @{post.author?.username}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold leading-none mt-0.5">
                    {post.author?.full_name}
                  </span>
                </div>
              </Link>
              
              {post.author?.id !== currentUser?.id && (
                <button
                  onClick={handleFollowToggle}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-xl transition cursor-pointer flex items-center space-x-1 ${
                    authorIsFollowing 
                      ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-350' 
                      : authorFollowPending
                      ? 'bg-zinc-50 text-zinc-400 cursor-default'
                      : 'bg-primary hover:bg-primary-hover text-white'
                  }`}
                >
                  {authorIsFollowing ? <UserCheck className="h-3 w-3 mr-0.5" /> : <UserPlus className="h-3 w-3 mr-0.5" />}
                  <span>{authorIsFollowing ? 'Following' : authorFollowPending ? 'Requested' : 'Follow'}</span>
                </button>
              )}
            </div>
          )}

          {/* 2. Scrollable comments feed panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Show caption here too as first item */}
            {post && post.content && hasMedia && (
              <div className="flex space-x-3 text-xs pb-3 border-b border-zinc-50 dark:border-zinc-850">
                <img 
                  src={post.author?.profile_picture || '/default-avatar.png'} 
                  alt={post.author?.username} 
                  className="h-8 w-8 rounded-full object-cover shrink-0" 
                />
                <div className="flex-1">
                  <p className="text-zinc-800 dark:text-zinc-205 leading-relaxed">
                    <Link href={`/${post.author?.username}`} className="font-extrabold hover:underline mr-1.5 text-zinc-900 dark:text-zinc-50" onClick={onClose}>
                      {post.author?.username}
                    </Link>
                    {post.content}
                  </p>
                </div>
              </div>
            )}

            {/* Comments list map */}
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onReplyTo={handleReplyTo}
                  onDeleteSuccess={handleCommentDelete}
                />
              ))}

              {hasNextComments && (
                <button
                  onClick={handleLoadMoreComments}
                  disabled={loadingComments}
                  className="w-full text-center py-2 text-[10px] font-black text-zinc-400 hover:text-zinc-600 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {loadingComments ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      <span>Load More Comments</span>
                    </>
                  )}
                </button>
              )}

              {!loadingComments && comments.length === 0 && (
                <div className="text-center py-10 text-[11px] text-zinc-400 font-bold">
                  No comments yet. Start the conversation!
                </div>
              )}
            </div>
          </div>

          {/* 3. Action bar & Input panel */}
          {post && (
            <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={handleLikeToggle}
                    className={`focus:outline-none transition-transform active:scale-125 ${
                      isLiked ? 'text-red-500 scale-110' : 'text-zinc-650 dark:text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    <Heart className={`h-6 w-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                  <button className="text-zinc-650 dark:text-zinc-400 hover:text-zinc-900" aria-label="Comments">
                    <MessageCircle className="h-6 w-6" />
                  </button>
                </div>
                <button 
                  onClick={handleBookmarkToggle}
                  className={`focus:outline-none transition-transform active:scale-125 ${
                    isBookmarked ? 'text-primary' : 'text-zinc-650 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <Bookmark className={`h-6 w-6 ${isBookmarked ? 'fill-primary text-primary' : ''}`} />
                </button>
              </div>

              {/* Likes counter details */}
              <div className="text-xs text-zinc-900 dark:text-zinc-100 font-black">
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </div>

              {/* Comment Input */}
              <form onSubmit={handleCommentSubmit}>
                <CommentInput
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  submitting={submitting}
                  replyTarget={replyTarget}
                  onCancelReply={() => {
                    setReplyTarget(null);
                    setCommentText('');
                  }}
                />
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
