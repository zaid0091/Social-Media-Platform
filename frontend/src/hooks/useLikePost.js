import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { postKeys } from '@/utils/queryKeys';
import useUIStore from '@/store/useUIStore';

export default function useLikePost() {
  const queryClient = useQueryClient();
  const addToast = useUIStore((state) => state.addToast);

  return useMutation({
    mutationFn: (postId) => api.post(`/posts/like/${postId}/`).then((res) => res.data),
    
    onMutate: async (postId) => {
      // Cancel any outgoing refetches to prevent overwriting
      await queryClient.cancelQueries({ queryKey: postKeys.all });
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });

      // Snapshot the previous post details
      const previousPostDetail = queryClient.getQueryData(postKeys.detail(postId));
      
      // Keep track of all matched cache queries for full rollback
      const queriesSnapshot = queryClient.getQueriesData({ queryKey: postKeys.all });

      const updatePostItem = (post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          is_liked: !post.is_liked,
          like_count: post.is_liked 
            ? Math.max(0, post.like_count - 1) 
            : post.like_count + 1,
        };
      };

      // Optimistically update all list caches (feeds, user posts lists, explore tabs)
      queryClient.setQueriesData({ queryKey: postKeys.all }, (oldData) => {
        if (!oldData) return oldData;
        
        if (oldData.pages) {
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              results: page.results.map(updatePostItem),
            })),
          };
        }
        if (Array.isArray(oldData)) {
          return oldData.map(updatePostItem);
        }
        if (typeof oldData === 'object' && oldData.id === postId) {
          return updatePostItem(oldData);
        }
        return oldData;
      });

      // Optimistically update the isolated detail query cache
      if (previousPostDetail) {
        queryClient.setQueryData(postKeys.detail(postId), updatePostItem(previousPostDetail));
      }

      return { previousPostDetail, queriesSnapshot };
    },

    onError: (err, postId, context) => {
      // Rollback all matched query caches
      if (context?.queriesSnapshot) {
        context.queriesSnapshot.forEach(([queryKey, oldData]) => {
          queryClient.setQueryData(queryKey, oldData);
        });
      }
      if (context?.previousPostDetail) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPostDetail);
      }
      addToast('Failed to update like status', 'error');
    },

    onSettled: (data, error, postId) => {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}
