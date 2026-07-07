import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import api from '../services/api';

const useFeedStore = create(
  devtools(
    (set, get) => ({
      posts: [],
      page: 1,
      loading: false,
      error: null,
      hasNextPage: true,
      newPostsAvailable: false,

      setPosts: (postsOrFn) => set((state) => ({ posts: typeof postsOrFn === 'function' ? postsOrFn(state.posts) : postsOrFn })),
      setPage: (pageOrFn) => set((state) => ({ page: typeof pageOrFn === 'function' ? pageOrFn(state.page) : pageOrFn })),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setHasNextPage: (hasNextPage) => set({ hasNextPage }),
      setNewPostsAvailable: (newPostsAvailable) => set({ newPostsAvailable }),

      fetchFeedPage: async (pageNumber, isRefresh = false) => {
        set({ loading: true, error: null });
        try {
          const res = await api.get(`/posts/feed/?page=${pageNumber}`);
          const results = res.data.results || [];
          
          set((state) => {
            let nextPosts;
            if (isRefresh) {
              nextPosts = results;
            } else {
              const existingIds = new Set(state.posts.map(p => p.id));
              const uniqueNewResults = results.filter(p => !existingIds.has(p.id));
              nextPosts = [...state.posts, ...uniqueNewResults];
            }
            return {
              posts: nextPosts,
              hasNextPage: !!res.data.next,
              page: pageNumber,
              loading: false
            };
          });
        } catch (err) {
          set({ 
            error: 'Failed to load posts feed. Please check your connection.', 
            loading: false 
          });
        }
      },

      handlePostDeleted: (deletedId) => set((state) => ({
        posts: state.posts.filter((p) => p.id !== deletedId)
      })),

      refreshFeed: () => {
        set({ newPostsAvailable: false, page: 1 });
        get().fetchFeedPage(1, true);
      }
    }),
    { name: 'FeedStore' }
  )
);

export default useFeedStore;
