import useMessagesStore from '@/store/messagesStore';

export default function useMessages() {
  const conversations = useMessagesStore((state) => state.conversations);
  const messages = useMessagesStore((state) => state.messages);
  const unreadCount = useMessagesStore((state) => state.unreadCount);
  const activeConversationId = useMessagesStore((state) => state.activeConversationId);
  const loading = useMessagesStore((state) => state.loading);
  const error = useMessagesStore((state) => state.error);
  const nextCursors = useMessagesStore((state) => state.nextCursors);

  const setConversations = useMessagesStore((state) => state.setConversations);
  const setActiveConversationId = useMessagesStore((state) => state.setActiveConversationId);
  const setMessages = useMessagesStore((state) => state.setMessages);
  const addOlderMessages = useMessagesStore((state) => state.addOlderMessages);
  const addMessage = useMessagesStore((state) => state.addMessage);
  const markConversationAsRead = useMessagesStore((state) => state.markConversationAsRead);
  const fetchConversations = useMessagesStore((state) => state.fetchConversations);
  const fetchMessages = useMessagesStore((state) => state.fetchMessages);

  return {
    conversations,
    messages,
    unreadCount,
    activeConversationId,
    loading,
    error,
    nextCursors,
    setConversations,
    setActiveConversationId,
    setMessages,
    addOlderMessages,
    addMessage,
    markConversationAsRead,
    fetchConversations,
    fetchMessages
  };
}
