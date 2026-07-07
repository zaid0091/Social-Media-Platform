import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { storyKeys } from '@/utils/queryKeys';

export default function useStories(options = {}) {
  return useQuery({
    queryKey: storyKeys.all,
    queryFn: () => api.get('/stories/').then((res) => res.data),
    ...options,
  });
}
