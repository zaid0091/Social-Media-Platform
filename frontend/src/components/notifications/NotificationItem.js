'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, UserPlus, AtSign, AlertCircle, ArrowUpRight, Check, X } from 'lucide-react';
import api from '@/services/api';

export default function NotificationItem({ notification, onMarkRead, onDelete }) {
  const { id, sender, notification_type, related_post, related_comment, is_read, created_at, follow_request_id } = notification;

  // Local follow status tracking
  const [isFollowing, setIsFollowing] = useState(sender?.is_following || false);
  const [followRequestState, setFollowRequestState] = useState(null); // 'accepted' | 'rejected' | null
  const [actionLoading, setActionLoading] = useState(false);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const diffMs = new Date() - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d`;
  };

  const handleFollowToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (actionLoading) return;
    setActionLoading(true);
    try {
      if (isFollowing) {
        await api.post(`/users/unfollow/${sender.id}/`);
        setIsFollowing(false);
      } else {
        await api.post(`/users/follow/${sender.id}/`);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Follow toggle failed', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFollowRequestAction = async (e, action) => {
    e.preventDefault();
    e.stopPropagation();
    if (actionLoading || !follow_request_id) return;
    setActionLoading(true);
    try {
      await api.post(`/users/follow-requests/${follow_request_id}/${action}/`);
      setFollowRequestState(action === 'accept' ? 'accepted' : 'rejected');
    } catch (err) {
      console.error('Follow request action failed', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Click handler to mark the item as read
  const handleItemClick = () => {
    if (!is_read && onMarkRead) {
      onMarkRead(id);
    }
  };

  // Determine redirection link for the card content click
  const getRedirectUrl = () => {
    if (notification_type === 'follow') {
      return `/${sender?.username}`;
    }
    if (related_post) {
      return `/posts/${related_post.id}`;
    }
    return '#';
  };

  const renderIcon = () => {
    switch (notification_type) {
      case 'like':
        return <div className="p-1.5 bg-red-500/10 text-red-500 rounded-full shrink-0"><Heart className="h-3.5 w-3.5 fill-red-500" /></div>;
      case 'comment':
        return <div className="p-1.5 bg-sky-500/10 text-sky-500 rounded-full shrink-0"><MessageCircle className="h-3.5 w-3.5" /></div>;
      case 'follow':
        return <div className="p-1.5 bg-violet-500/10 text-violet-500 rounded-full shrink-0"><UserPlus className="h-3.5 w-3.5" /></div>;
      case 'mention':
        return <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-full shrink-0"><AtSign className="h-3.5 w-3.5" /></div>;
      case 'warning':
        return <div className="p-1.5 bg-red-600/10 text-red-600 rounded-full shrink-0"><AlertCircle className="h-3.5 w-3.5" /></div>;
      default:
        return null;
    }
  };

  const renderTextContent = () => {
    switch (notification_type) {
      case 'like':
        return (
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            <span className="font-bold text-zinc-950 dark:text-zinc-50 mr-1">{sender?.username}</span> 
            liked your post.
          </p>
        );
      case 'comment':
        return (
          <div className="flex flex-col space-y-0.5">
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-bold text-zinc-950 dark:text-zinc-50 mr-1">{sender?.username}</span> 
              commented on your post.
            </p>
            {related_comment && (
              <p className="text-[11px] italic text-zinc-500 dark:text-zinc-400 line-clamp-1">
                "{related_comment.content}"
              </p>
            )}
          </div>
        );
      case 'follow':
        if (follow_request_id) {
          if (followRequestState === 'accepted') {
            return (
              <p className="text-xs text-zinc-500">
                You accepted <span className="font-bold text-zinc-900 dark:text-zinc-100">{sender?.username}</span>'s follow request.
              </p>
            );
          }
          if (followRequestState === 'rejected') {
            return (
              <p className="text-xs text-zinc-550">
                You declined <span className="font-bold text-zinc-900 dark:text-zinc-100">{sender?.username}</span>'s follow request.
              </p>
            );
          }
          return (
            <p className="text-xs text-zinc-650 dark:text-zinc-300">
              <span className="font-bold text-zinc-950 dark:text-zinc-50 mr-1">{sender?.username}</span> 
              requested to follow you.
            </p>
          );
        }
        return (
          <p className="text-xs text-zinc-650 dark:text-zinc-300">
            <span className="font-bold text-zinc-950 dark:text-zinc-50 mr-1">{sender?.username}</span> 
            started following you.
          </p>
        );
      case 'mention':
        return (
          <div className="flex flex-col space-y-0.5">
            <p className="text-xs text-zinc-650 dark:text-zinc-300">
              <span className="font-bold text-zinc-950 dark:text-zinc-50 mr-1">{sender?.username}</span> 
              mentioned you in a comment.
            </p>
            {related_comment && (
              <p className="text-[11px] italic text-zinc-500 dark:text-zinc-400 line-clamp-1">
                "{related_comment.content}"
              </p>
            )}
          </div>
        );
      case 'warning':
        return (
          <p className="text-xs text-red-500 font-semibold leading-relaxed">
            {related_comment?.content || "Your account has received a security warning. Please check your preferences."}
          </p>
        );
      default:
        return null;
    }
  };

  const renderActionContainer = () => {
    if (notification_type === 'follow') {
      if (follow_request_id) {
        if (followRequestState) return null;
        return (
          <div className="flex items-center space-x-2 shrink-0 z-30">
            <button
              onClick={(e) => handleFollowRequestAction(e, 'accept')}
              disabled={actionLoading}
              className="p-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
              aria-label="Accept Request"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
            </button>
            <button
              onClick={(e) => handleFollowRequestAction(e, 'reject')}
              disabled={actionLoading}
              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition disabled:opacity-50 cursor-pointer"
              aria-label="Decline Request"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      }

      // Normal Follow Back button
      return (
        <button
          onClick={handleFollowToggle}
          disabled={actionLoading}
          className={`px-3 py-1.5 rounded-xl text-xs font-black select-none shrink-0 transition-all cursor-pointer z-30 border ${
            isFollowing 
              ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800' 
              : 'bg-primary hover:bg-primary-hover text-white border-transparent'
          }`}
        >
          {isFollowing ? 'Following' : 'Follow Back'}
        </button>
      );
    }

    // Media Thumbnail for post/comment/mentions
    if (related_post && related_post.thumbnail_url) {
      return (
        <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-850 rounded-lg overflow-hidden shrink-0 border border-zinc-100 dark:border-zinc-800">
          <img src={related_post.thumbnail_url} alt="Post preview" className="w-full h-full object-cover" />
        </div>
      );
    }

    return null;
  };

  return (
    <Link 
      href={getRedirectUrl()}
      onClick={handleItemClick}
      className={`flex items-center justify-between p-4 border border-zinc-100 dark:border-zinc-850/50 rounded-2xl hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-all relative ${
        !is_read 
          ? 'bg-primary/[0.03] dark:bg-primary/[0.015] border-l-2 border-l-primary' 
          : 'bg-white dark:bg-zinc-900/40'
      }`}
    >
      <div className="flex items-center space-x-3.5 flex-1 min-w-0 mr-4">
        {/* Unread circle badge */}
        {!is_read && (
          <span className="h-1.5 w-1.5 bg-primary rounded-full shrink-0 animate-ping absolute left-1.5" />
        )}
        
        {/* Avatar */}
        <div className="relative shrink-0">
          {sender?.profile_picture ? (
            <img 
              src={sender.profile_picture} 
              alt={sender.username} 
              className="h-10 w-10 rounded-full object-cover border border-zinc-200/40 dark:border-zinc-800/40"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-350 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center font-bold text-zinc-650 dark:text-zinc-350 text-sm">
              {sender?.username?.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Action icon badge overlay */}
          <div className="absolute -bottom-1 -right-1">
            {renderIcon()}
          </div>
        </div>

        {/* Text descriptions */}
        <div className="flex-1 min-w-0 text-left">
          {renderTextContent()}
          <span className="text-[10px] font-bold text-zinc-400 mt-0.5 block">{formatTime(created_at)}</span>
        </div>
      </div>

      {/* Action / Thumbnails */}
      {renderActionContainer()}
    </Link>
  );
}
