import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { postKeys } from '@/utils/queryKeys';

export default function usePost(postId, options = {}) {
  return useQuery({
    queryKey: postKeys.detail(postId),
    queryFn: () => api.get(`/posts/${postId}/`).then((res) => res.data),
    enabled: !!postId,
    ...options,
  });
}
