import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { userKeys } from '@/utils/queryKeys';

export default function useUserProfile(username, options = {}) {
  const fetchUrl = username === 'profile' 
    ? '/users/profile/' 
    : `/users/profile/${username}/`;

  return useQuery({
    queryKey: userKeys.profile(username),
    queryFn: () => api.get(fetchUrl).then((res) => res.data),
    enabled: !!username,
    ...options,
  });
}
