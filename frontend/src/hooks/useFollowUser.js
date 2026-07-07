import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { userKeys } from '@/utils/queryKeys';

export default function useFollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, username }) => 
      api.post(`/users/follow/${userId}/`).then((res) => res.data),

    onMutate: async ({ username }) => {
      if (!username) return;

      // Cancel outgoing profile queries
      await queryClient.cancelQueries({ queryKey: userKeys.profile(username) });

      // Snapshot the previous profile value
      const previousProfile = queryClient.getQueryData(userKeys.profile(username));

      // Optimistically update the profile follow counters
      if (previousProfile) {
        const isFollowing = previousProfile.is_following;
        queryClient.setQueryData(userKeys.profile(username), {
          ...previousProfile,
          is_following: !isFollowing,
          follower_count: isFollowing 
            ? Math.max(0, previousProfile.follower_count - 1) 
            : previousProfile.follower_count + 1
        });
      }

      return { previousProfile, username };
    },

    onError: (err, variables, context) => {
      // Rollback on failure
      if (context?.username && context?.previousProfile) {
        queryClient.setQueryData(
          userKeys.profile(context.username), 
          context.previousProfile
        );
      }
    },

    onSettled: (data, error, variables) => {
      // Invalidate profile query to align with DB state
      if (variables.username) {
        queryClient.invalidateQueries({ queryKey: userKeys.profile(variables.username) });
      }
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    }
  });
}
