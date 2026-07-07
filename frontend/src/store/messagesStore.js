import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import api from '../services/api';

const useMessagesStore = create(
  devtools(
    (set, get) => ({
      conversations: [],
      messages: {}, // key: conversationId, value: message[]
      unreadCount: 0,
      activeConversationId: null,
      loading: false,
      error: null,
      nextCursors: {}, // key: conversationId, value: nextCursorUrl

      setConversations: (conversations) => set({ conversations }),
      setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
      
      setMessages: (conversationId, messagesOrFn) => set((state) => {
        const currentMessages = state.messages[conversationId] || [];
        const nextMessages = typeof messagesOrFn === 'function' ? messagesOrFn(currentMessages) : messagesOrFn;
        return {
          messages: { ...state.messages, [conversationId]: nextMessages }
        };
      }),

      addOlderMessages: (conversationId, olderMessages) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: [...olderMessages, ...(state.messages[conversationId] || [])]
        }
      })),

      addMessage: (conversationId, message) => set((state) => {
        const currentMessages = state.messages[conversationId] || [];
        // Prevent duplicate message additions
        if (currentMessages.some((m) => m.id === message.id)) {
          return {};
        }

        const updatedMessages = [...currentMessages, message];

        // Update corresponding conversation's last_message in lists
        const updatedConversations = state.conversations.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              last_message: message,
              unread_count: state.activeConversationId === conversationId ? 0 : (c.unread_count || 0) + 1
            };
          }
          return c;
        });

        // Re-sort conversations so the one with the newest message is first
        updatedConversations.sort((a, b) => {
          const timeA = new Date(a.last_message?.created_at || a.created_at);
          const timeB = new Date(b.last_message?.created_at || b.created_at);
          return timeB - timeA;
        });

        return {
          messages: { ...state.messages, [conversationId]: updatedMessages },
          conversations: updatedConversations
        };
      }),

      markConversationAsRead: async (conversationId) => {
        try {
          await api.post(`/messaging/conversations/${conversationId}/read/`);
          set((state) => ({
            conversations: state.conversations.map((c) => 
              c.id === conversationId ? { ...c, unread_count: 0 } : c
            )
          }));
        } catch (err) {
          console.error('Failed to mark conversation as read', err);
        }
      },

      fetchConversations: async () => {
        set({ loading: true, error: null });
        try {
          const res = await api.get('/messaging/conversations/');
          const results = res.data.results || [];
          
          // Calculate overall unread count
          const totalUnread = results.reduce((acc, c) => acc + (c.unread_count || 0), 0);

          set({
            conversations: results,
            unreadCount: totalUnread,
            loading: false
          });
        } catch (err) {
          set({
            error: 'Failed to load conversations.',
            loading: false
          });
        }
      },

      fetchMessages: async (conversationId, cursorUrl = null) => {
        const isInitial = !cursorUrl;
        if (isInitial) {
          set({ loading: true, error: null });
        }
        
        try {
          const url = cursorUrl 
            ? `/messaging/conversations/${conversationId}/?cursor=${cursorUrl}` 
            : `/messaging/conversations/${conversationId}/`;
          const res = await api.get(url);
          
          // If cursorUrl is set, we are prepending older messages, otherwise replacing
          const fetchedMessages = res.data.messages?.results || [];
          const reversed = [...fetchedMessages].reverse(); // reverse since newest are first

          const nextCursor = res.data.messages?.next || null;

          set((state) => {
            const nextMessages = isInitial 
              ? reversed 
              : [...reversed, ...(state.messages[conversationId] || [])];
              
            return {
              messages: { ...state.messages, [conversationId]: nextMessages },
              nextCursors: { ...state.nextCursors, [conversationId]: nextCursor },
              loading: false
            };
          });

          // Also set conversation details if initial
          if (isInitial && res.data.conversation) {
            set((state) => {
              // Ensure conversation is in lists or update it
              const exists = state.conversations.some((c) => c.id === conversationId);
              let updatedConversations = state.conversations;
              if (exists) {
                updatedConversations = state.conversations.map((c) => 
                  c.id === conversationId ? res.data.conversation : c
                );
              } else {
                updatedConversations = [res.data.conversation, ...state.conversations];
              }
              return { conversations: updatedConversations };
            });
          }
        } catch (err) {
          set({
            error: 'Failed to load messages.',
            loading: false
          });
        }
      }
    }),
    { name: 'MessagesStore' }
  )
);

export default useMessagesStore;
