import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { conversationKeys } from '@/utils/queryKeys';

export default function useConversations(options = {}) {
  return useQuery({
    queryKey: conversationKeys.all,
    queryFn: () => api.get('/messaging/conversations/').then((res) => res.data),
    ...options,
  });
}
