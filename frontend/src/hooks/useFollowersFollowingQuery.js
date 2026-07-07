import { useInfiniteQuery } from '@tanstack/react-query';
import api from '@/services/api';

export function useUserFollowersQuery(userId, options = {}) {
  return useInfiniteQuery({
    queryKey: ['users', userId, 'followers'],
    queryFn: async ({ pageParam = null }) => {
      const url = pageParam 
        ? `/users/${userId}/followers/?cursor=${pageParam}` 
        : `/users/${userId}/followers/`;
      const res = await api.get(url);
      return res.data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next || undefined,
    enabled: !!userId,
    ...options,
  });
}

export function useUserFollowingQuery(userId, options = {}) {
  return useInfiniteQuery({
    queryKey: ['users', userId, 'following'],
    queryFn: async ({ pageParam = null }) => {
      const url = pageParam 
        ? `/users/${userId}/following/?cursor=${pageParam}` 
        : `/users/${userId}/following/`;
      const res = await api.get(url);
      return res.data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next || undefined,
    enabled: !!userId,
    ...options,
  });
}
