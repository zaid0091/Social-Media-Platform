import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { userKeys } from '@/utils/queryKeys';

export default function useUserPosts(userId, options = {}) {
  return useQuery({
    queryKey: userKeys.posts(userId),
    queryFn: () => api.get(`/posts/user/${userId}/`).then((res) => res.data),
    enabled: !!userId,
    ...options,
  });
}
