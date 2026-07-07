'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { userKeys, postKeys } from '@/utils/queryKeys';

export default function PrefetchLink({ href, type, entityId, children, ...props }) {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    if (!entityId) return;

    if (type === 'profile') {
      // Prefetch public profile data
      queryClient.prefetchQuery({
        queryKey: userKeys.profile(entityId),
        queryFn: () => api.get(`/users/profile/${entityId}/`).then((res) => res.data),
        staleTime: 1000 * 60 * 5, // 5 minutes
      });
    } else if (type === 'post') {
      // Prefetch individual post details
      queryClient.prefetchQuery({
        queryKey: postKeys.detail(entityId),
        queryFn: () => api.get(`/posts/${entityId}/`).then((res) => res.data),
        staleTime: 1000 * 60 * 5,
      });
    }
  };

  return (
    <Link href={href} onMouseEnter={handleMouseEnter} {...props}>
      {children}
    </Link>
  );
}
