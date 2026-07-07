'use client';

import useInfiniteScroll from '@/hooks/useInfiniteScroll';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export default function FlatList({
  data = [],
  renderItem,
  keyExtractor,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isError,
  error,
  refetch,
  ListEmptyComponent,
  ListFooterComponent,
  className = ''
}) {
  const sentinelRef = useInfiniteScroll({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  });

  // Prevent duplicates in rendering
  const seenKeys = new Set();
  const uniqueData = data.filter((item, index) => {
    const key = keyExtractor ? keyExtractor(item, index) : item.id || index;
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });

  return (
    <div className={`flex flex-col ${className}`}>
      {/* List items */}
      {uniqueData.map((item, index) => renderItem({ item, index }))}

      {/* Empty State */}
      {uniqueData.length === 0 && !isLoading && !isError && (
        ListEmptyComponent || (
          <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400">
            <span className="text-sm font-semibold">No items to display</span>
          </div>
        )
      )}

      {/* Sentinel / Footer element */}
      <div ref={sentinelRef} className="w-full min-h-[40px] flex items-center justify-center py-4">
        {/* Loading Spinner */}
        {(isLoading || isFetchingNextPage) && (
          ListFooterComponent || (
            <div className="flex items-center justify-center space-x-2 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading items...</span>
            </div>
          )
        )}

        {/* Error Retry controls */}
        {isError && !isLoading && !isFetchingNextPage && (
          <div className="flex flex-col items-center space-y-2 py-2">
            <div className="flex items-center space-x-1.5 text-red-500 text-xs font-semibold">
              <AlertCircle className="h-4 w-4" />
              <span>{error?.message || 'Failed to load more items.'}</span>
            </div>
            <button
              onClick={() => refetch && refetch()}
              className="px-3 py-1 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-950 rounded-lg text-[10px] font-bold hover:opacity-90 transition-opacity flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* End of list */}
        {!hasNextPage && uniqueData.length > 0 && !isLoading && !isError && (
          <div className="text-center py-2 text-zinc-450 dark:text-zinc-500 text-xs font-semibold select-none">
            <span>You've reached the end of the list</span>
          </div>
        )}
      </div>
    </div>
  );
}
