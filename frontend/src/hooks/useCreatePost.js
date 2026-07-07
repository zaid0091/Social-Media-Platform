import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { postKeys } from '@/utils/queryKeys';

export default function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData) => 
      api.post('/posts/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).then((res) => res.data),
    onSuccess: () => {
      // Invalidate feed and post lists to trigger refetch
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    }
  });
}
