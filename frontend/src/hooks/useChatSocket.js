'use client';

import { useEffect, useRef, useState } from 'react';

// Play a synthesized chime using Web Audio API (D5 -> A5) to alert users of new incoming messages
export const playMessageSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {
    // Fail silently if browser blocks autoplay before interaction
  }
};

export default function useChatSocket({
  conversationId,
  accessToken,
  currentUser,
  onMessage,
  onTyping,
  onReadReceipt,
  onReaction,
  onReconnect
}) {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const wasDisconnected = useRef(false);
  const reconnectDelayRef = useRef(1000); // Backoff starts at 1s
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'

  // Ref to hold the latest callbacks to avoid stale closures inside WebSocket event handlers
  const callbacksRef = useRef({});
  useEffect(() => {
    callbacksRef.current = {
      currentUser,
      onMessage,
      onTyping,
      onReadReceipt,
      onReaction,
      onReconnect
    };
  }, [currentUser, onMessage, onTyping, onReadReceipt, onReaction, onReconnect]);

  const connect = () => {
    if (!conversationId || !accessToken) return;

    // Guard against multiple connections
    if (socketRef.current && (socketRef.current.readyState === WebSocket.CONNECTING || socketRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    setConnectionStatus('connecting');

    const wsUrl = `ws://127.0.0.1:8000/ws/chat/${conversationId}/?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectDelayRef.current = 1000; // Reset reconnect backoff on success

      // Send initial read receipt
      ws.send(JSON.stringify({ type: 'read_receipt' }));

      // If reconnected, run SWR/REST cache sync
      if (wasDisconnected.current) {
        if (callbacksRef.current.onReconnect) {
          callbacksRef.current.onReconnect();
        }
        wasDisconnected.current = false;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            // Play sound if sender is NOT the current user
            const currentUserId = callbacksRef.current.currentUser?.id;
            const currentUsername = callbacksRef.current.currentUser?.username;
            const isOwnMessage = data.message?.sender?.id === currentUserId || 
                                 (data.message?.sender?.username && data.message?.sender?.username === currentUsername);

            if (!isOwnMessage) {
              playMessageSound();
            }
            if (callbacksRef.current.onMessage) {
              callbacksRef.current.onMessage(data.message);
            }
            break;

          case 'typing':
            if (callbacksRef.current.onTyping) {
              callbacksRef.current.onTyping(data.sender_id, data.username, data.is_typing);
            }
            break;

          case 'read_receipt':
            if (callbacksRef.current.onReadReceipt) {
              callbacksRef.current.onReadReceipt(data.reader_id, data.username);
            }
            break;

          case 'reaction':
            if (callbacksRef.current.onReaction) {
              callbacksRef.current.onReaction(data);
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Error parsing chat WS frame', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wasDisconnected.current = true;

      // Exponential backoff reconnect delay doubling to max 30s
      const currentDelay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(currentDelay * 2, 30000);

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, currentDelay);
    };

    ws.onerror = (err) => {
      console.error('Chat WebSocket Error:', err);
      ws.close();
    };
  };

  useEffect(() => {
    connect();

    return () => {
      // Disconnect socket and clear reconnects on navigated away
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [conversationId, accessToken]);

  const sendMessage = (payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  };

  return { connectionStatus, sendMessage };
}
