import useFeedStore from '@/store/feedStore';

export default function useFeed() {
  const posts = useFeedStore((state) => state.posts);
  const page = useFeedStore((state) => state.page);
  const loading = useFeedStore((state) => state.loading);
  const error = useFeedStore((state) => state.error);
  const hasNextPage = useFeedStore((state) => state.hasNextPage);
  const newPostsAvailable = useFeedStore((state) => state.newPostsAvailable);

  const setPosts = useFeedStore((state) => state.setPosts);
  const setPage = useFeedStore((state) => state.setPage);
  const setLoading = useFeedStore((state) => state.setLoading);
  const setError = useFeedStore((state) => state.setError);
  const setHasNextPage = useFeedStore((state) => state.setHasNextPage);
  const setNewPostsAvailable = useFeedStore((state) => state.setNewPostsAvailable);
  const fetchFeedPage = useFeedStore((state) => state.fetchFeedPage);
  const handlePostDeleted = useFeedStore((state) => state.handlePostDeleted);
  const refreshFeed = useFeedStore((state) => state.refreshFeed);

  return {
    posts,
    page,
    loading,
    error,
    hasNextPage,
    newPostsAvailable,
    setPosts,
    setPage,
    setLoading,
    setError,
    setHasNextPage,
    setNewPostsAvailable,
    fetchFeedPage,
    handlePostDeleted,
    refreshFeed
  };
}
