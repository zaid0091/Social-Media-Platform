import { useInfiniteQuery } from '@tanstack/react-query';
import api from '@/services/api';

export default function useCommentsQuery(postId, options = {}) {
  return useInfiniteQuery({
    queryKey: ['posts', postId, 'comments'],
    queryFn: async ({ pageParam = null }) => {
      const url = pageParam 
        ? `/posts/${postId}/comments/?cursor=${pageParam}` 
        : `/posts/${postId}/comments/`;
      const res = await api.get(url);
      return res.data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next || undefined,
    enabled: !!postId,
    ...options,
  });
}
