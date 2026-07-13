'use client';

import { useState, useEffect } from 'react';
import { UserPlus, UserCheck, UserMinus, Clock, X } from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import useUI from '@/hooks/useUI';

export default function FollowButton({
  userId,
  username,
  initialIsFollowing = false,
  initialFollowRequestPending = false,
  isPrivate = false,
  onStateChange,
  className = ''
}) {
  const { user: currentUser } = useAuthStore();
  const { addToast } = useUI();
  
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, setIsPending] = useState(initialFollowRequestPending);
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Sync state if initial props change
  useEffect(() => {
    setIsFollowing(initialIsFollowing);
    setIsPending(initialFollowRequestPending);
  }, [initialIsFollowing, initialFollowRequestPending]);

  // Don't render follow button if it's the current user themselves
  if (currentUser && currentUser.id === userId) {
    return null;
  }

  const handleFollowAction = async () => {
    if (loading) return;
    setLoading(true);

    const prevFollowing = isFollowing;
    const prevPending = isPending;

    // 1. Optimistic state transitions
    if (isFollowing) {
      // Unfollow
      setIsFollowing(false);
      setIsPending(false);
      if (onStateChange) onStateChange(false, false);
    } else if (isPending) {
      // Cancel request
      setIsFollowing(false);
      setIsPending(false);
      if (onStateChange) onStateChange(false, false);
    } else {
      // Follow
      if (isPrivate) {
        setIsPending(true);
        if (onStateChange) onStateChange(false, true);
      } else {
        setIsFollowing(true);
        if (onStateChange) onStateChange(true, false);
      }
    }

    try {
      if (prevFollowing || prevPending) {
        // Call unfollow API endpoint
        await api.post(`/users/unfollow/${userId}/`);
      } else {
        // Call follow API endpoint
        await api.post(`/users/follow/${userId}/`);
      }
    } catch (err) {
      console.error('Failed to toggle follow status', err);
      // Revert optimistic state on error
      setIsFollowing(prevFollowing);
      setIsPending(prevPending);
      if (onStateChange) onStateChange(prevFollowing, prevPending);
      addToast('Failed to update follow status', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Render appropriate visual state labels and styles
  let btnText = 'Follow';
  let btnIcon = <UserPlus className="h-4 w-4 mr-1.5" />;
  let btnStyles = 'border-primary text-primary hover:bg-primary/5 bg-transparent';

  if (isFollowing) {
    if (isHovered) {
      btnText = 'Unfollow';
      btnIcon = <UserMinus className="h-4 w-4 mr-1.5 text-red-500" />;
      btnStyles = 'bg-red-50/80 border-red-200 text-red-650 hover:bg-red-100 hover:border-red-300 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400';
    } else {
      btnText = 'Following';
      btnIcon = <UserCheck className="h-4 w-4 mr-1.5" />;
      btnStyles = 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-800 dark:text-zinc-200';
    }
  } else if (isPending) {
    if (isHovered) {
      btnText = 'Cancel';
      btnIcon = <X className="h-4 w-4 mr-1.5 text-red-500" />;
      btnStyles = 'bg-red-50/80 border-red-200 text-red-650 hover:bg-red-100 hover:border-red-300 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400';
    } else {
      btnText = 'Requested';
      btnIcon = <Clock className="h-4 w-4 mr-1.5 text-zinc-400" />;
      btnStyles = 'bg-zinc-50 border-zinc-200 text-zinc-400 dark:bg-zinc-850 dark:border-zinc-800 dark:text-zinc-500 cursor-default';
    }
  }

  return (
    <button
      onClick={handleFollowAction}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`px-4 py-2 border text-xs font-black rounded-xl transition-all duration-150 flex items-center justify-center cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${btnStyles} ${className}`}
    >
      {btnIcon}
      <span>{btnText}</span>
    </button>
  );
}
