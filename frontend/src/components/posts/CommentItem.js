'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Heart, 
  MessageCircle, 
  ChevronDown, 
  ChevronUp, 
  MoreHorizontal, 
  Trash2, 
  Edit3, 
  AlertTriangle,
  X,
  Check,
  CornerDownRight
} from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';

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

// Sub-component to manage nested comment replies dynamically
function RepliesList({ commentId, onReplyTo, onReplyDelete }) {
  const { data: repliesData, error, mutate } = useSWR(`/posts/comments/${commentId}/replies/`, (url) => 
    api.get(url).then(r => r.data)
  );
  const replies = repliesData?.results || [];
  const { user: currentUser } = useAuthStore();

  const handleReplyDelete = async (replyId) => {
    try {
      await api.delete(`/posts/comments/${replyId}/delete/`);
      mutate();
      if (onReplyDelete) onReplyDelete();
    } catch (err) {}
  };

  if (error) return <p className="text-xs text-red-500 pl-12 py-1">Failed to load replies.</p>;
  if (!repliesData) return <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin ml-12 my-2" />;

  return (
    <div className="pl-6 mt-2 space-y-3 border-l border-zinc-100 dark:border-zinc-800 ml-4">
      {replies.map((reply) => {
        const isOwnReply = currentUser && reply.author.id === currentUser.id;
        return (
          <div key={reply.id} className="flex space-x-2 text-xs relative group/reply">
            <CornerDownRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
            
            {/* Reply avatar */}
            {reply.author.profile_picture ? (
              <img 
                src={reply.author.profile_picture} 
                alt={reply.author.username} 
                className="h-6 w-6 rounded-full object-cover border border-zinc-150 dark:border-zinc-850 shrink-0"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-[10px] shrink-0">
                {reply.author.username?.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Reply body */}
            <div className="flex-1 min-w-0">
              <p className="text-zinc-850 dark:text-zinc-200">
                <Link href={`/${reply.author.username}`} className="font-extrabold hover:underline mr-1 text-zinc-900 dark:text-zinc-100">
                  {reply.author.username}
                </Link>
                {reply.content}
              </p>
              <div className="flex items-center space-x-3 text-zinc-500 mt-1 font-semibold">
                <span>{getRelativeTime(reply.created_at)}</span>
                <button 
                  onClick={() => onReplyTo(commentId, reply.author.username)}
                  className="hover:underline cursor-pointer"
                >
                  Reply
                </button>
                {isOwnReply && (
                  <button 
                    onClick={() => handleReplyDelete(reply.id)}
                    className="text-red-500 hover:underline cursor-pointer opacity-0 group-hover/reply:opacity-100 transition-opacity ml-2"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// SWR auto-import hook check
import useSWR from 'swr';

export default function CommentItem({ comment, onReply, onDelete, onEdit }) {
  const { user: currentUser } = useAuthStore();
  
  // Likes states
  const [isLiked, setIsLiked] = useState(comment.is_liked);
  const [likeCount, setLikeCount] = useState(comment.like_count || 0);
  const [animateHeart, setAnimateHeart] = useState(false);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  // Deletion/options states
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [toast, setToast] = useState(null);

  const menuRef = useRef(null);

  useEffect(() => {
    setIsLiked(comment.is_liked);
    setLikeCount(comment.like_count || 0);
    setEditContent(comment.content);
  }, [comment]);

  useEffect(() => {
    const clickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // Text parser mapping #hashtags and @mentions to Next.js links
  const parseContent = (text) => {
    if (!text) return '';
    const parts = text.split(/([#@][a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <Link key={index} href={`/search?q=${encodeURIComponent(part)}`} className="text-primary hover:underline font-bold">
            {part}
          </Link>
        );
      } else if (part.startsWith('@')) {
        const username = part.slice(1);
        return (
          <Link key={index} href={`/${username}`} className="text-primary hover:underline font-bold">
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  const handleLikeToggle = async (e) => {
    e.stopPropagation();
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((prev) => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    if (!wasLiked) {
      setAnimateHeart(true);
      setTimeout(() => setAnimateHeart(false), 500);
    }

    try {
      await api.post(`/posts/comment-like/${comment.id}/`);
    } catch (err) {
      setIsLiked(wasLiked);
      setLikeCount((prev) => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await api.patch(`/posts/comments/${comment.id}/`, { content: editContent });
      setIsEditing(false);
      if (onEdit) onEdit(comment.id, editContent);
    } catch (err) {}
  };

  const handleConfirmDelete = async () => {
    setShowConfirmDelete(false);
    try {
      await api.delete(`/posts/comments/${comment.id}/delete/`);
      if (onDelete) onDelete(comment.id);
    } catch (err) {}
  };

  const isOwnComment = currentUser && comment.author.id === currentUser.id;

  return (
    <div className="flex flex-col space-y-2 select-none relative">
      {/* Toast popup */}
      {toast && (
        <div className="absolute top-0 right-4 z-20 px-3 py-1 bg-zinc-800 text-white rounded-lg text-xs font-semibold">
          {toast}
        </div>
      )}

      {/* Confirmation Dialog Overlay */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-850 p-6 rounded-2xl max-w-xs w-full text-center space-y-4 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Delete comment?</h3>
            <p className="text-xs text-zinc-500">Are you sure you want to permanently delete this comment? This action is irreversible.</p>
            <div className="flex space-x-2 pt-2">
              <button 
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Body block */}
      <div className="flex space-x-3 items-start text-sm group/comment">
        {/* Commenter Avatar */}
        <Link href={`/${comment.author.username}`} className="shrink-0">
          {comment.author.profile_picture ? (
            <img 
              src={comment.author.profile_picture} 
              alt={comment.author.username} 
              className="h-8 w-8 rounded-full object-cover border border-zinc-150 dark:border-zinc-850"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs">
              {comment.author.username?.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>

        {/* Content detail layout */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            /* Inline Edit Mode Form */
            <div className="space-y-2 mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all resize-none"
              />
              <div className="flex space-x-2 justify-end">
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="px-3 py-1 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            /* Standard Comment presentation */
            <>
              <p className="text-zinc-850 dark:text-zinc-200 leading-relaxed">
                <Link href={`/${comment.author.username}`} className="font-extrabold hover:underline mr-1 text-zinc-900 dark:text-zinc-100">
                  {comment.author.username}
                </Link>
                {parseContent(comment.content)}
              </p>

              <div className="flex items-center space-x-4 text-xs text-zinc-500 mt-1 font-semibold">
                <span>{getRelativeTime(comment.created_at)}</span>
                <button 
                  onClick={() => onReply(comment.id, comment.author.username)}
                  className="hover:underline font-bold cursor-pointer"
                >
                  Reply
                </button>
              </div>
            </>
          )}
        </div>

        {/* Options Menu icon & dropdown trigger */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Like button controls */}
          <button 
            onClick={handleLikeToggle}
            className={`flex items-center space-x-1 hover:text-red-500 cursor-pointer ${
              isLiked ? 'text-red-500 animate-pulse' : 'text-zinc-400'
            }`}
            aria-label="Like comment"
          >
            <Heart 
              className={`h-4 w-4 transition-transform ${
                isLiked ? 'fill-red-500 text-red-500' : ''
              } ${animateHeart ? 'scale-125' : 'scale-100'}`} 
            />
            {likeCount > 0 && <span className="text-xs font-semibold">{likeCount}</span>}
          </button>

          {/* Three-dot dropdown menu trigger */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-350 cursor-pointer opacity-0 group-hover/comment:opacity-100 transition-opacity"
              aria-label="Comment options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg z-20 py-1 text-xs font-semibold overflow-hidden">
                {isOwnComment ? (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit Comment</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowConfirmDelete(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setToast('Report submitted');
                      setIsMenuOpen(false);
                      setTimeout(() => setToast(null), 2500);
                    }}
                    className="w-full text-left px-3 py-2 text-amber-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Report</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Collapsible replies drawers section */}
      {comment.reply_count > 0 && (
        <div className="pl-11">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center space-x-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350 cursor-pointer select-none"
          >
            {showReplies ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>
              {showReplies ? 'Hide replies' : `View replies (${comment.reply_count})`}
            </span>
          </button>
          
          {showReplies && (
            <RepliesList 
              commentId={comment.id} 
              onReplyTo={onReply}
              onReplyDelete={() => {
                // Trigger recount SWR triggers in parent if a nested reply gets deleted
                if (onEdit) onEdit(comment.id, comment.content);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
