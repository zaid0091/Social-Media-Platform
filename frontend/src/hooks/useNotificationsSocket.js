'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import useAuthStore from '../store/useAuthStore';
import useNotificationStore from '../store/useNotificationStore';
import api from '../services/api';
import { useSWRConfig } from 'swr';
import Link from 'next/link';

// Custom Toast Renderer Component
function CustomToast({ notification, t }) {
  const getRedirectUrl = () => {
    if (notification.notification_type === 'follow') {
      return `/${notification.sender?.username}`;
    }
    if (notification.related_post) {
      return `/posts/${notification.related_post.id}`;
    }
    return '#';
  };

  const getActionText = () => {
    switch (notification.notification_type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return `commented: "${notification.related_comment?.content || ''}"`;
      case 'follow':
        return 'started following you';
      case 'mention':
        return 'mentioned you in a comment';
      case 'warning':
        return notification.related_comment?.content || 'received a system warning';
      default:
        return 'sent you an update';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-zinc-950 text-white rounded-xl border border-zinc-800 shadow-2xl w-full max-w-sm">
      <div className="flex items-center space-x-3 min-w-0 mr-4">
        {notification.sender?.profile_picture ? (
          <img 
            src={notification.sender.profile_picture} 
            alt={notification.sender.username} 
            className="h-9 w-9 rounded-full object-cover border border-zinc-800"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
            {notification.sender?.username?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col text-left min-w-0">
          <span className="text-xs font-bold text-white">@{notification.sender?.username}</span>
          <span className="text-[11px] text-zinc-400 truncate max-w-[200px]">{getActionText()}</span>
        </div>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <Link 
          href={getRedirectUrl()}
          onClick={() => toast.dismiss(t)}
          className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-white text-[10px] font-black rounded-lg transition"
        >
          View
        </Link>
      </div>
    </div>
  );
}

export default function useNotificationsSocket() {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const wasDisconnected = useRef(false);
  const reconnectDelayRef = useRef(1000); // Start reconnect delay at 1s
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'

  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  
  const { mutate } = useSWRConfig();

  const connect = () => {
    if (!isAuthenticated || !accessToken) return;
    
    // Clear any existing reconnect timer
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Guard against multiple concurrent connections
    if (socketRef.current && (socketRef.current.readyState === WebSocket.CONNECTING || socketRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    setConnectionStatus('connecting');

    const wsUrl = `ws://127.0.0.1:8000/ws/notifications/?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectDelayRef.current = 1000; // Reset reconnect delay back to 1s on success

      // If this was a reconnection, fetch missed notifications from REST API
      if (wasDisconnected.current) {
        // 1. Refetch unread count to resync navigation badge
        api.get('/notifications/unread-count/')
          .then((res) => {
            setUnreadCount(res.data.unread_count || 0);
          })
          .catch(() => {});

        // 2. Re-trigger SWR notifications page refresh
        mutate('/notifications/?page=1');
        wasDisconnected.current = false;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          const notification = data.notification;
          // Add notification to state store (this also increments unreadCount internally)
          addNotification(notification);

          // Dispatch custom event for real-time notification prepend page updates
          const customEvent = new CustomEvent('new-notification-received', { detail: notification });
          window.dispatchEvent(customEvent);

          // Display premium custom toast notification bubble
          toast.custom((t) => (
            <CustomToast notification={notification} t={t} />
          ), { duration: 5000 });
        }
      } catch (err) {
        console.error('Error parsing notification message', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wasDisconnected.current = true;

      // Calculate exponential backoff reconnect timer (doubling delay up to max 30s)
      const currentDelay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(currentDelay * 2, 30000);

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, currentDelay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      ws.close();
    };
  };

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount or token change
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, accessToken]);

  return { connectionStatus };
}
