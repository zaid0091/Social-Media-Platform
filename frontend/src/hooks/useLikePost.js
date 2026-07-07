import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { postKeys } from '@/utils/queryKeys';

export default function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId) => api.post(`/posts/like/${postId}/`).then((res) => res.data),
    
    onMutate: async (postId) => {
      // Cancel any outgoing refetches to prevent overwriting
      await queryClient.cancelQueries({ queryKey: postKeys.all });
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });

      // Snapshot the previous values from details query
      const previousPostDetail = queryClient.getQueryData(postKeys.detail(postId));

      // Optimistically toggle single post detail details in cache
      if (previousPostDetail) {
        queryClient.setQueryData(postKeys.detail(postId), {
          ...previousPostDetail,
          is_liked: !previousPostDetail.is_liked,
          like_count: previousPostDetail.is_liked 
            ? Math.max(0, previousPostDetail.like_count - 1) 
            : previousPostDetail.like_count + 1,
        });
      }

      // Return rollback context
      return { previousPostDetail };
    },

    onError: (err, postId, context) => {
      // Rollback to previous state
      if (context?.previousPostDetail) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPostDetail);
      }
    },

    onSettled: (data, error, postId) => {
      // Ensure cache remains in sync with server state
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}
