import { useEffect, useRef } from 'react';

export default function useInfiniteScroll({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasNextPage || isFetchingNextPage || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => {
      if (element) observer.unobserve(element);
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoading]);

  return sentinelRef;
}
