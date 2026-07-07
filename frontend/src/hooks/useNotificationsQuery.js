import { useInfiniteQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { notificationKeys } from '@/utils/queryKeys';

export default function useNotificationsQuery(options = {}) {
  return useInfiniteQuery({
    queryKey: notificationKeys.all,
    queryFn: async ({ pageParam = null }) => {
      const url = pageParam 
        ? `/notifications/?cursor=${pageParam}` 
        : '/notifications/';
      const res = await api.get(url);
      return res.data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next || undefined,
    ...options,
  });
}
