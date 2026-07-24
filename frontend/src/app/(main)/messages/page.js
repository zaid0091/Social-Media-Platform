'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Mail, SquarePen, Users, ArrowLeft } from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import useMessages from '@/hooks/useMessages';
import useConversations from '@/hooks/useConversations';
import NewConversationModal from '@/components/messaging/NewConversationModal';
import ChatWindow from '@/components/messaging/ChatWindow';
import MessageSkeleton from '@/components/ui/MessageSkeleton';

function MessagesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get('c');
  const { user: currentUser } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use React Query conversations hook
  const { data, isLoading, refetch: fetchConversations } = useConversations();
  const conversationsList = data?.results || data || [];

  // Fetch conversations list initially
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Handle direct conversation creation if redirected from a user profile (?userId=...)
  const targetUserId = searchParams.get('userId');
  useEffect(() => {
    if (targetUserId) {
      const getOrCreateDirectConversation = async () => {
        try {
          const response = await api.post('/messaging/conversations/create/', {
            recipient_id: targetUserId
          });
          const newConv = response.data;
          // Refresh list cache
          fetchConversations();
          // Navigate to new conversation view
          router.push(`/messages?c=${newConv.id}`);
        } catch (err) {
          console.error('Failed to get/create direct conversation', err);
        }
      };
      getOrCreateDirectConversation();
    }
  }, [targetUserId, router, fetchConversations]);

  // Listen to real-time custom message events to revalidate list cache instantly
  useEffect(() => {
    const handleNewMessage = () => {
      fetchConversations();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('chat-message-received', handleNewMessage);
      return () => window.removeEventListener('chat-message-received', handleNewMessage);
    }
  }, [fetchConversations]);

  // Filter conversations locally based on search query
  const filteredConversations = conversationsList.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    if (c.is_group) {
      return c.group_name?.toLowerCase().includes(query);
    }
    // Check DM participants (excluding current user)
    const otherParticipant = c.participants?.find((p) => p.id !== currentUser?.id);
    return (
      otherParticipant?.username?.toLowerCase().includes(query) ||
      otherParticipant?.full_name?.toLowerCase().includes(query)
    );
  });

  const getConversationDetails = (c) => {
    if (c.is_group) {
      return {
        name: c.group_name || 'Group Chat',
        avatar: c.group_avatar,
        isOnline: false,
      };
    }
    const otherParticipant = c.participants?.find((p) => p.id !== currentUser?.id);
    return {
      name: otherParticipant?.username || 'User',
      avatar: otherParticipant?.profile_picture,
      isOnline: otherParticipant?.is_online || false,
    };
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleSelectConversation = (id) => {
    router.push(`/messages?c=${id}`);
  };

  const handleGoBack = () => {
    router.push('/messages');
  };

  return (
    <div className="flex-1 flex h-[calc(100dvh-4rem)] md:h-[calc(100vh-0rem)] relative overflow-hidden bg-white dark:bg-zinc-900">
      
      {/* LEFT COLUMN: Conversation List */}
      <div 
        className={`w-full md:w-80 xl:w-96 border-r border-zinc-200 dark:border-zinc-800 flex-shrink-0 flex flex-col h-full ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        
        {/* Left header */}
        <header className="px-5 py-4 flex items-center justify-between border-b border-zinc-150 dark:border-zinc-850">
          <h1 className="text-xl font-black text-zinc-950 dark:text-zinc-50">Messages</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 rounded-xl transition cursor-pointer"
            aria-label="New Conversation"
          >
            <SquarePen className="h-5 w-5" />
          </button>
        </header>

        {/* Search bar wrapper */}
        <div className="p-4 border-b border-zinc-150 dark:border-zinc-850">
          <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2xl px-3.5 py-2.5 transition">
            <Search className="h-4 w-4 text-zinc-400 mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs w-full outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
          </div>
        </div>

        {/* Conversations Scroll pane */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && conversationsList.length === 0 ? (
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <MessageSkeleton key={i} />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <p className="text-xs font-bold text-zinc-400">
                {searchQuery ? "No conversations found" : "No messages yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredConversations.map((c) => {
                const details = getConversationDetails(c);
                const isActive = activeConversationId === c.id;
                const lastMsg = c.last_message;
                const hasUnread = c.unread_count > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`flex items-center justify-between p-3 rounded-2.5xl cursor-pointer transition relative group ${
                      isActive 
                        ? 'bg-primary/10 text-primary border border-primary/20' 
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-950/20 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0 mr-4">
                      {/* Avatar & Online Dot */}
                      <div className="relative shrink-0">
                        {details.avatar ? (
                          <img 
                            src={details.avatar} 
                            alt={details.name} 
                            className="h-11 w-11 rounded-full object-cover border border-zinc-200/40 dark:border-zinc-800/40"
                          />
                        ) : c.is_group ? (
                          <div className="h-11 w-11 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                            <Users className="h-5 w-5" />
                          </div>
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-650 dark:text-zinc-350 text-sm">
                            {details.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* Online status indicator dot */}
                        {details.isOnline && (
                          <span className="absolute bottom-0.5 right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white dark:border-zinc-900" title="Online" />
                        )}
                      </div>

                      {/* Name & Text preview */}
                      <div className="flex flex-col text-left min-w-0">
                        <span className={`text-xs font-bold leading-normal truncate ${
                          isActive ? 'text-primary' : 'text-zinc-900 dark:text-zinc-100'
                        }`}>
                          {c.is_group ? details.name : `@${details.name}`}
                        </span>
                        
                        <p className={`text-[11px] truncate leading-normal ${
                          hasUnread 
                            ? 'text-zinc-900 dark:text-zinc-50 font-black' 
                            : 'text-zinc-400 dark:text-zinc-500 font-semibold'
                        }`}>
                          {lastMsg ? lastMsg.content : 'No messages yet'}
                        </p>
                      </div>
                    </div>

                    {/* Meta info: Time & Badge */}
                    <div className="flex flex-col items-end space-y-1.5 shrink-0">
                      <span className="text-[9px] font-black text-zinc-400">
                        {lastMsg ? formatMessageTime(lastMsg.created_at) : ''}
                      </span>
                      {c.unread_count > 0 && (
                        <span className="min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 animate-badge-pop">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Chat Panel (Detail) */}
      <div 
        className={`flex-1 flex flex-col h-full ${
          activeConversationId ? 'flex' : 'hidden md:flex bg-zinc-50/50 dark:bg-zinc-950/20'
        }`}
      >
        {activeConversationId ? (
          <ChatWindow 
            conversationId={activeConversationId} 
            onGoBack={handleGoBack} 
          />
        ) : (
          /* Desktop Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 text-primary mb-6 animate-pulse">
              <Mail className="h-10 w-10 stroke-[1.25]" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50 mb-1">
              Your Messages
            </h2>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed mb-6">
              Send private photos, posts, and messages to a friend or group.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-black rounded-2xl select-none cursor-pointer transition duration-150"
            >
              Send Message
            </button>
          </div>
        )}
      </div>

      {/* New conversation modal trigger */}
      <NewConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectConversation={handleSelectConversation}
      />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-screen bg-white dark:bg-zinc-900">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
          <p className="text-xs text-zinc-405 font-bold">Loading Messages layout...</p>
        </div>
      </div>
    }>
      <MessagesClient />
    </Suspense>
  );
}
