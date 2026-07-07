import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { conversationKeys } from '@/utils/queryKeys';

export default function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content, mediaUrl, messageType, repliedToId }) =>
      api.post('/messaging/messages/', {
        conversation_id: conversationId,
        content,
        media_url: mediaUrl,
        message_type: messageType || 'text',
        replied_to_id: repliedToId
      }).then((res) => res.data),
      
    onSuccess: (data, variables) => {
      // Invalidate both the target conversation detail/messages query and the list query
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    }
  });
}
