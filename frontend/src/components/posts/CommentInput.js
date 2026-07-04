'use client';

import { useState, useRef, useEffect } from 'react';
import { Smile, X, Send } from 'lucide-react';

export default function CommentInput({
  user,
  replyTarget,
  onCancelReply,
  onSubmit,
  commentText,
  setCommentText,
  submitting = false
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-expand textarea height on input change
  const handleInputChange = (e) => {
    const textarea = e.target;
    setCommentText(textarea.value);
    
    // Auto-resize height
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  // Close emoji picker on click outside
  useEffect(() => {
    const clickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // Sync cursor focus when reply target changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTarget]);

  const handleAddEmoji = (emoji) => {
    setCommentText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    onSubmit(commentText);
    
    // Reset height after submit
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const emojis = ['😃', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤔', '👍', '👎', '🔥', '👏', '🎉', '❤️', '💔'];

  return (
    <div className="border-t border-zinc-150 dark:border-zinc-800 p-4 relative bg-white dark:bg-zinc-900 shrink-0 select-none">
      {/* 1. Reply Target Header Banner */}
      {replyTarget && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 rounded-lg mb-2 text-xs text-primary font-semibold">
          <span>Replying to @{replyTarget.username}</span>
          <button 
            onClick={onCancelReply} 
            className="p-0.5 rounded-full hover:bg-primary/10 cursor-pointer"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Emoji Popover panel */}
      {showEmojiPicker && (
        <div 
          ref={emojiRef} 
          className="absolute bottom-[72px] left-4 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 grid grid-cols-8 gap-2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleAddEmoji(emoji)}
              className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center text-lg cursor-pointer transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* 3. Typing Row Form */}
      <form onSubmit={handleSubmitForm} className="flex items-end space-x-3">
        {/* User avatar */}
        <div className="shrink-0 mb-1.5 hidden sm:block">
          {user?.profile_picture ? (
            <img 
              src={user.profile_picture} 
              alt={user.username} 
              className="h-8 w-8 rounded-full object-cover border border-zinc-200/50 dark:border-zinc-800/50"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Emoji trigger */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 cursor-pointer transition-colors mb-1"
          aria-label="Add Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>

        {/* Typing box */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={commentText}
          onChange={handleInputChange}
          placeholder={replyTarget ? "Write a reply..." : "Add a comment..."}
          className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all resize-none max-h-24 overflow-y-auto leading-relaxed"
        />

        {/* Send Action */}
        <button
          type="submit"
          disabled={submitting || !commentText.trim()}
          className="p-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:bg-primary text-white rounded-xl shadow-md transition-all cursor-pointer shrink-0 mb-1"
          aria-label="Send Comment"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
