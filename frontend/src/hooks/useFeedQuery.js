import { useInfiniteQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { postKeys } from '@/utils/queryKeys';

export default function useFeedQuery(options = {}) {
  return useInfiniteQuery({
    queryKey: postKeys.feed(options),
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get(`/posts/feed/?page=${pageParam}`);
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      try {
        const url = new URL(lastPage.next);
        const pageStr = url.searchParams.get('page');
        return pageStr ? parseInt(pageStr, 10) : undefined;
      } catch (e) {
        // Fallback if URL is relative path
        const match = lastPage.next.match(/[?&]page=(\d+)/);
        return match ? parseInt(match[1], 10) : undefined;
      }
    },
    ...options,
  });
}
