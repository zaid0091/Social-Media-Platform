'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Phone, Video, Info, Send, Smile, Paperclip, 
  MoreVertical, Reply, Trash2, CheckCheck, Check, SmilePlus, X
} from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import useChatSocket from '@/hooks/useChatSocket';
import useMessages from '@/hooks/useMessages';

// Common emojis for quick reaction picker
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatWindow({ conversationId, onGoBack }) {
  const router = useRouter();
  const { accessToken, user: currentUser } = useAuthStore();
  
  // Message list state and actions from Zustand store
  const {
    messages: storeMessagesMap,
    nextCursors,
    fetchMessages,
    addMessage,
    setMessages,
    conversations
  } = useMessages();

  const messages = storeMessagesMap[conversationId] || [];
  const nextCursorUrl = nextCursors[conversationId] || null;
  const conversation = conversations.find((c) => c.id === conversationId) || null;

  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Input states
  const [textInput, setTextInput] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('text');
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  
  // Real-time states
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherTypingUser, setOtherTypingUser] = useState('');

  // Popup overlay states
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Fetch initial details and messages
  const fetchConversationDetails = async (isInitial = true) => {
    if (isInitial) setLoading(true);
    try {
      await fetchMessages(conversationId);
    } catch (err) {
      console.error('Failed to load chat details', err);
    } finally {
      if (isInitial) {
        setLoading(false);
        // Scroll to bottom on initial mount
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 100);
      }
    }
  };

  useEffect(() => {
    if (conversationId) {
      fetchConversationDetails(true);
    }
  }, [conversationId]);

  const handleIncomingMessage = (newMsg) => {
    const isMyMessage = newMsg.sender?.id === currentUser?.id || 
                        (newMsg.sender?.username && newMsg.sender?.username === currentUser?.username);

    // 1. If it's our own message, check if there's a pending optimistic message we can resolve
    if (isMyMessage) {
      const pendingIndex = messages.findIndex(
        (m) => m.status === 'pending' && 
               m.content === newMsg.content && 
               (m.media_url || '') === (newMsg.media_url || '')
      );
      if (pendingIndex !== -1) {
        const updated = [...messages];
        updated[pendingIndex] = { ...newMsg, status: 'sent' }; // Replace optimistic with real
        setMessages(conversationId, updated);
        return;
      }
    }

    // 2. Prevent duplicate message additions and dispatch to store
    addMessage(conversationId, newMsg);

    // Send read receipt if we are the recipient of this new incoming message
    if (!isMyMessage) {
      sendMessage({ type: 'read_receipt' });
    }

    // Notify other components (like the conversation list) to update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chat-message-received'));
    }

    // Scroll to bottom on new message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleTypingEvent = (senderId, username, isTyping) => {
    if (senderId !== currentUser?.id) {
      setIsOtherTyping(isTyping);
      setOtherTypingUser(username);
    }
  };

  const handleReadReceiptEvent = (readerId, username) => {
    if (readerId !== currentUser?.id) {
      setMessages(conversationId, 
        messages.map((m) => m.sender?.id === currentUser?.id ? { ...m, is_read: true } : m)
      );
    }
  };

  const handleReactionEvent = (data) => {
    setMessages(conversationId, 
      prev.map((m) => {
        if (m.id === data.message_id) {
          let updatedReactions = m.reactions || [];
          if (data.action === 'removed') {
            updatedReactions = updatedReactions.filter(
              (r) => !(r.username === data.username && r.emoji === data.emoji)
            );
          } else {
            updatedReactions = updatedReactions.filter((r) => r.username !== data.username);
            updatedReactions.push({
              user_id: data.user_id,
              username: data.username,
              emoji: data.emoji
            });
          }
          return { ...m, reactions: updatedReactions };
        }
        return m;
      })
    );
  };

  const handleReconnectEvent = () => {
    // Refetch history from REST API to sync any missed messages
    fetchConversationDetails(false);
  };

  // Mount clean useChatSocket hook
  const { connectionStatus, sendMessage } = useChatSocket({
    conversationId,
    accessToken,
    currentUser,
    onMessage: handleIncomingMessage,
    onTyping: handleTypingEvent,
    onReadReceipt: handleReadReceiptEvent,
    onReaction: handleReactionEvent,
    onReconnect: handleReconnectEvent
  });

  // Intersection Observer for Read Receipts
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    // Find unread messages sent by the other user
    const unreadOthers = messages.filter((m) => m.sender?.id !== currentUser?.id && !m.is_read);
    if (unreadOthers.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      const isVisible = entries.some((entry) => entry.isIntersecting);
      if (isVisible) {
        sendMessage({ type: 'read_receipt' });
        // Disconnect immediately after marking read to save memory
        observer.disconnect();
      }
    }, { threshold: 0.1 });

    unreadOthers.forEach((m) => {
      const el = document.getElementById(`msg-${m.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [messages, connectionStatus, currentUser, sendMessage]);

  // Load older messages (cursor pagination on scroll to top)
  const loadOlderMessages = async () => {
    if (!nextCursorUrl || loadingOlder) return;
    setLoadingOlder(true);
    
    const container = scrollContainerRef.current;
    const oldScrollHeight = container?.scrollHeight || 0;

    try {
      const response = await api.get(nextCursorUrl);
      const olderMessages = response.data.results || [];
      
      setMessages((prev) => [...olderMessages.reverse(), ...prev]);
      setNextCursorUrl(response.data.next || null);

      setTimeout(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - oldScrollHeight;
        }
      }, 50);

    } catch (err) {
      console.error('Failed to load older messages', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleScroll = (e) => {
    if (e.currentTarget.scrollTop === 0) {
      loadOlderMessages();
    }
  };

  // Typing status event emitter
  const handleTextInputChange = (e) => {
    setTextInput(e.target.value);

    if (connectionStatus === 'connected') {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendMessage({ type: 'typing', is_typing: true });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendMessage({ type: 'typing', is_typing: false });
      }, 2000);
    }
  };

  // Message Send dispatcher
  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!textInput.trim() && !mediaUrl) return;

    // 1. Optimistic Message Sending: append a pending card immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      content: textInput,
      media_url: mediaUrl,
      message_type: mediaUrl ? mediaType : 'text',
      sender: {
        id: currentUser?.id,
        username: currentUser?.username,
        profile_picture: currentUser?.profile_picture
      },
      created_at: new Date().toISOString(),
      is_read: false,
      status: 'pending', // Optimistic sending status
      replied_to: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        media_url: replyingTo.media_url,
        message_type: replyingTo.message_type,
        sender_username: replyingTo.sender?.username
      } : null,
      reactions: []
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    
    // Clear input accessories immediately
    const contentToSend = textInput;
    const mediaUrlToSend = mediaUrl;
    const mediaTypeToSend = mediaUrl ? mediaType : 'text';
    const repliedToIdToSend = replyingTo?.id || null;

    setTextInput('');
    setMediaUrl('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    // Stop typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    sendMessage({ type: 'typing', is_typing: false });

    // 2. Dispatch payload via WebSocket
    const sent = sendMessage({
      type: 'message',
      content: contentToSend,
      media_url: mediaUrlToSend,
      message_type: mediaTypeToSend,
      replied_to_id: repliedToIdToSend
    });

    // Mark as failed if socket is offline
    if (!sent) {
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, status: 'failed' } : m)
      );
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chat-message-received'));
    }

    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Keyboard shortcut Send on Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // File media upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/messaging/messages/upload-media/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMediaUrl(response.data.media_url);
      setMediaType(response.data.media_type || 'image');
    } catch (err) {
      console.error('File upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId) => {
    try {
      await api.delete(`/messaging/messages/${messageId}/`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setActiveMenuId(null);
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  // Toggle emoji reactions
  const handleReactToMessage = (messageId, emoji) => {
    sendMessage({
      type: 'reaction',
      message_id: messageId,
      emoji: emoji
    });
    setActiveReactionPickerId(null);
    setActiveMenuId(null);
  };

  // Group messages chronologically by day
  const groupMessagesByDate = (messagesList) => {
    const groups = {};
    messagesList.forEach((msg) => {
      const dateStr = new Date(msg.created_at).toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(msg);
    });
    return groups;
  };

  const getRecipientInfo = () => {
    if (conversation?.is_group) {
      return {
        name: conversation.group_name || 'Group Chat',
        avatar: conversation.group_avatar,
        statusText: `${conversation.participants?.length || 0} participants`
      };
    }
    const otherParticipant = conversation?.participants?.find((p) => p.id !== currentUser?.id);
    return {
      name: otherParticipant?.username || 'User',
      avatar: otherParticipant?.profile_picture,
      statusText: otherParticipant?.is_online ? 'Active now' : 'Offline'
    };
  };

  const recipient = getRecipientInfo();
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900 overflow-hidden relative">
      
      {/* 1. CHAT HEADER PANEL */}
      <header className="h-16 border-b border-zinc-150 dark:border-zinc-850 flex items-center px-4 justify-between shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl z-20">
        <div className="flex items-center space-x-3.5 min-w-0">
          
          {/* Back button (mobile) */}
          <button
            onClick={onGoBack}
            className="md:hidden p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-zinc-650 dark:text-zinc-350" />
          </button>

          {/* Profile Avatar */}
          <div className="relative shrink-0">
            {recipient.avatar ? (
              <img 
                src={recipient.avatar} 
                alt={recipient.name} 
                className="h-10 w-10 rounded-full object-cover border border-zinc-200/40 dark:border-zinc-800/40"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                {recipient.name.charAt(0).toUpperCase()}
              </div>
            )}
            {recipient.statusText === 'Active now' && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border border-white dark:border-zinc-900 animate-pulse" />
            )}
          </div>

          {/* Name & Online Subtext */}
          <div className="flex flex-col text-left min-w-0">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 leading-tight">
              {conversation?.is_group ? recipient.name : `@${recipient.name}`}
            </span>
            <span className="text-[10px] text-zinc-400 font-semibold leading-none mt-0.5">
              {isOtherTyping ? `${otherTypingUser || 'User'} is typing...` : recipient.statusText}
            </span>
          </div>
        </div>

        {/* Action placeholder controls */}
        <div className="flex items-center space-x-1.5 shrink-0 text-zinc-500">
          <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer" title="Voice Call (Placeholder)"><Phone className="h-4.5 w-4.5" /></button>
          <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer" title="Video Call (Placeholder)"><Video className="h-4.5 w-4.5" /></button>
          <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer" title="Details"><Info className="h-4.5 w-4.5" /></button>
        </div>
      </header>

      {/* 2. MESSAGES FEED PANELS */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/30 dark:bg-zinc-950/5"
      >
        {loadingOlder && (
          <div className="flex justify-center py-2">
            <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
          </div>
        )}

        {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
          <div key={dateLabel} className="space-y-3.5">
            <div className="flex justify-center">
              <span className="bg-zinc-200/50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                {dateLabel}
              </span>
            </div>

            {/* Messages iteration */}
            {msgs.map((msg) => {
              const isOwn = msg.sender?.id === currentUser?.id;
              const hasRepliedTo = !!msg.replied_to;
              const isMenuOpen = activeMenuId === msg.id;
              const isReactionPickerOpen = activeReactionPickerId === msg.id;

              return (
                <div 
                  key={msg.id} 
                  id={`msg-${msg.id}`}
                  className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} space-y-1 relative group`}
                >
                  
                  {/* Replied Message preview block */}
                  {hasRepliedTo && (
                    <div className={`text-[10px] text-zinc-400 dark:text-zinc-500 px-3 py-1 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/30 dark:border-zinc-800/20 max-w-sm mb-1 ${
                      isOwn ? 'mr-1' : 'ml-1'
                    }`}>
                      <span className="font-extrabold mr-1 text-zinc-500">@{msg.replied_to.sender_username}:</span>
                      <span>{msg.replied_to.content}</span>
                    </div>
                  )}

                  <div className={`flex items-center space-x-1.5 ${isOwn ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                    
                    {/* Message Bubble Card */}
                    <div className="relative group/bubble max-w-sm">
                      <div 
                        className={`px-4 py-2.5 rounded-2.5xl text-xs leading-normal select-text relative shadow-sm border ${
                          isOwn 
                            ? 'bg-primary text-white border-transparent rounded-tr-sm' 
                            : 'bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-150 border-zinc-100 dark:border-zinc-800/80 rounded-tl-sm'
                        } ${msg.status === 'pending' ? 'opacity-65' : ''} ${msg.status === 'failed' ? 'border-red-500 bg-red-50 text-red-900' : ''}`}
                      >
                        {/* Media rendering (Image/Video) */}
                        {msg.media_url && (
                          <div className="mb-2 max-w-xs rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800">
                            {msg.message_type === 'video' ? (
                              <video src={msg.media_url} controls className="w-full h-auto object-cover max-h-48" />
                            ) : (
                              <img src={msg.media_url} alt="Attached Media" className="w-full h-auto object-cover max-h-48" />
                            )}
                          </div>
                        )}
                        
                        {/* Message content text */}
                        {msg.content && <p className="whitespace-pre-wrap text-left">{msg.content}</p>}
                        
                        {/* Hover timestamp tooltip */}
                        <span className="hidden group-hover/bubble:inline-block absolute -bottom-5 left-1/2 -translate-x-1/2 bg-zinc-950 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-xl shrink-0 z-30">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Emojis Reaction list overlay */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={`absolute -bottom-2 ${isOwn ? 'left-2' : 'right-2'} flex items-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded-full shadow-md space-x-0.5`}>
                          {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => (
                            <span key={emoji} className="text-[10px]" title={msg.reactions.filter((r) => r.emoji === emoji).map((r) => r.username).join(', ')}>
                              {emoji}
                            </span>
                          ))}
                          {msg.reactions.length > 1 && (
                            <span className="text-[8px] font-bold text-zinc-400 pl-0.5">{msg.reactions.length}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Three-dot Context menu toggle */}
                    <div className="opacity-0 group-hover:opacity-100 transition duration-150 relative">
                      <button 
                        onClick={() => setActiveMenuId(isMenuOpen ? null : msg.id)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full cursor-pointer"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>

                      {/* Dropdown Menu actions */}
                      {isMenuOpen && (
                        <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-40 py-1 w-28`}>
                          
                          <button
                            onClick={() => {
                              setReplyingTo(msg);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-[11px] text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left font-bold cursor-pointer"
                          >
                            <Reply className="h-3.5 w-3.5 text-zinc-400" />
                            <span>Reply</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setActiveReactionPickerId(isReactionPickerOpen ? null : msg.id);
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-[11px] text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left font-bold cursor-pointer"
                          >
                            <SmilePlus className="h-3.5 w-3.5 text-zinc-400" />
                            <span>React</span>
                          </button>

                          {isOwn && msg.status !== 'pending' && (
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="w-full flex items-center space-x-2 px-3 py-2 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 text-left font-bold cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Emoji reaction picker bubble */}
                      {isReactionPickerOpen && (
                        <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-10 flex items-center bg-zinc-950 border border-zinc-850 px-2 py-1.5 rounded-full shadow-2xl space-x-1.5 z-40 animate-badge-pop`}>
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReactToMessage(msg.id, emoji)}
                              className="hover:scale-125 transition duration-100 text-xs shrink-0 cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Read receipts checkmarks */}
                  {isOwn && (
                    <div className="flex items-center space-x-1 mr-1">
                      {msg.status === 'pending' ? (
                        <span className="h-2.5 w-2.5 border border-zinc-450 border-t-transparent rounded-full animate-spin shrink-0" title="Sending..." />
                      ) : msg.status === 'failed' ? (
                        <span className="text-[10px] text-red-500 font-bold" title="Tap to retry">Failed</span>
                      ) : msg.is_read ? (
                        <CheckCheck className="h-3 w-3 text-blue-500 stroke-[2.5]" title="Read" />
                      ) : (
                        <Check className="h-3 w-3 text-zinc-405" title="Sent" />
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 3. INPUT BAR PANEL */}
      <footer className="p-3.5 border-t border-zinc-150 dark:border-zinc-850 bg-white dark:bg-zinc-900 shrink-0 z-20">
        <form onSubmit={handleSendMessage} className="space-y-2">
          
          {/* Replying-to Preview Bar */}
          {replyingTo && (
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl">
              <div className="flex items-center space-x-2 text-left min-w-0 mr-4">
                <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex flex-col text-xs min-w-0">
                  <span className="font-extrabold text-zinc-900 dark:text-zinc-205">Replying to @{replyingTo.sender?.username}</span>
                  <span className="text-zinc-500 truncate text-[10px]">{replyingTo.content || '[Media Attachment]'}</span>
                </div>
              </div>
              <button 
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
          )}

          {/* Media Attachments Preview bar */}
          {mediaUrl && (
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl">
              <div className="flex items-center space-x-2">
                <Paperclip className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-zinc-500 font-bold truncate max-w-xs">Attached: {mediaUrl.slice(0, 30)}...</span>
              </div>
              <button 
                onClick={() => setMediaUrl('')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
          )}

          {/* Core Controls Row */}
          <div className="flex items-end space-x-2.5">
            
            {/* Attachment Button */}
            <div className="relative shrink-0">
              <label className="p-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 text-zinc-550 dark:text-zinc-400 rounded-2xl flex items-center justify-center cursor-pointer transition">
                <Paperclip className="h-4.5 w-4.5" />
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,video/*"
                  disabled={uploading}
                />
              </label>
              {uploading && (
                <span className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                  <span className="h-3.5 w-3.5 rounded-full border border-white border-t-transparent animate-spin" />
                </span>
              )}
            </div>

            {/* Input field */}
            <div className="flex-1 relative flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2.5xl px-4 py-2 transition-all focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent">
              <textarea
                placeholder="Message..."
                value={textInput}
                onChange={handleTextInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                className="w-full bg-transparent text-xs outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 resize-none max-h-24 leading-relaxed"
                style={{ height: 'auto' }}
              />
              
              {/* Emoji quick picker trigger */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 hover:bg-zinc-150 dark:hover:bg-zinc-850 rounded-full text-zinc-400 hover:text-zinc-650 cursor-pointer shrink-0 ml-2"
                aria-label="Add Emoji"
              >
                <Smile className="h-4.5 w-4.5" />
              </button>

              {/* Emoji popover bar */}
              {showEmojiPicker && (
                <div className="absolute right-0 bottom-14 flex items-center bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-full shadow-2xl space-x-2 z-40 animate-badge-pop">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setTextInput((prev) => prev + emoji);
                      }}
                      className="hover:scale-125 transition duration-100 text-sm cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!textInput.trim() && !mediaUrl) || uploading}
              className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-2xl flex items-center justify-center transition disabled:opacity-50 disabled:hover:bg-primary cursor-pointer shrink-0"
              aria-label="Send Message"
            >
              <Send className="h-4.5 w-4.5" />
            </button>

          </div>
        </form>
      </footer>
      
    </div>
  );
}
