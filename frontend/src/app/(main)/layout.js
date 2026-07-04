'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import useSWR from 'swr';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import LeftSidebar from '@/components/navigation/LeftSidebar';
import BottomNav from '@/components/navigation/BottomNav';
import CreatePostFAB from '@/components/navigation/CreatePostFAB';
import PostCreateModal from '@/components/posts/PostCreateModal';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function MainLayout({ children }) {
  const { isAuthenticated, isLoading, refreshSession } = useAuthStore();
  const router = useRouter();

  // SWR queries for Right Sidebar
  const { data: suggestions, mutate: mutateSuggestions } = useSWR(
    isAuthenticated ? '/users/suggestions/' : null,
    fetcher
  );
  const { data: trending } = useSWR(
    isAuthenticated ? '/hashtags/trending/' : null,
    fetcher
  );

  const handleFollowSuggestion = async (userId) => {
    try {
      await api.post(`/users/follow/${userId}/`);
      // Update suggestions list
      mutateSuggestions();
    } catch (err) {}
  };

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      refreshSession();
    }
  }, [isAuthenticated, isLoading, refreshSession]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 rounded-full border-4 border-zinc-200 dark:border-zinc-800 border-t-primary animate-spin" />
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Loading social platform...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-200">
      <div className="w-full max-w-7xl mx-auto flex min-h-screen relative">
        
        {/* Left Column: Sidebar Navigation (Desktop) */}
        <LeftSidebar />

        {/* Center Column: Page Content Area */}
        <main className="flex-1 min-w-0 min-h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 pb-16 md:pb-0">
          {children}
        </main>

        {/* Right Column: Sidebar Suggestions & Trending (Desktop) */}
        <aside className="hidden lg:flex flex-col w-80 h-screen sticky top-0 p-6 space-y-6 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/50">
          {/* Search box placeholder */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              disabled
            />
          </div>

          {/* Suggestions Widget */}
          <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
            <h3 className="font-bold text-base px-2">Who to follow</h3>
            <div className="flex flex-col space-y-3">
              {suggestions && suggestions.length > 0 ? (
                suggestions.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-2">
                    <Link href={`/${item.username}`} className="flex items-center space-x-3 min-w-0 group">
                      {item.profile_picture ? (
                        <img 
                          src={item.profile_picture} 
                          alt={item.username} 
                          className="h-8 w-8 rounded-full object-cover border border-zinc-200/50 dark:border-zinc-800/50"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs shrink-0">
                          {item.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold truncate leading-tight group-hover:underline">{item.full_name || item.username}</span>
                        <span className="text-xs text-zinc-500 truncate">@{item.username}</span>
                      </div>
                    </Link>
                    <button 
                      onClick={() => handleFollowSuggestion(item.id)}
                      className="px-3 py-1 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-950 rounded-full text-xs font-bold hover:opacity-90 transition-opacity shrink-0 cursor-pointer select-none"
                    >
                      Follow
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 px-2">No follow suggestions available</p>
              )}
            </div>
          </div>

          {/* Trending Widget */}
          <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
            <h3 className="font-bold text-base px-2">Trending Topics</h3>
            <div className="flex flex-col space-y-3">
              {trending && trending.length > 0 ? (
                trending.slice(0, 5).map((item) => (
                  <Link 
                    key={item.id || item.name} 
                    href={`/search?q=${encodeURIComponent('#' + item.name)}`}
                    className="flex flex-col px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 p-1.5 rounded-xl transition-all cursor-pointer"
                  >
                    <span className="text-sm font-bold text-zinc-850 dark:text-zinc-150">#{item.name}</span>
                    <span className="text-xs text-zinc-500">{item.count || 0} posts</span>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-zinc-500 px-2">No trending topics right now</p>
              )}
            </div>
          </div>

          {/* Footer Widget */}
          <footer className="px-4 text-xs text-zinc-500 space-y-2 select-none">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="hover:underline cursor-pointer">About</span>
              <span className="hover:underline cursor-pointer">Terms of Service</span>
              <span className="hover:underline cursor-pointer">Privacy Policy</span>
              <span className="hover:underline cursor-pointer">Cookie Policy</span>
              <span className="hover:underline cursor-pointer">Careers</span>
            </div>
            <p className="font-medium">© 2026 Social Media Platform</p>
          </footer>
        </aside>

      </div>

      {/* Sticky Bottom Navigation Bar (Mobile only) */}
      <BottomNav />

      {/* Floating Action Button (Mobile only) */}
      <CreatePostFAB />

      {/* Global Post Creation Modal overlay */}
      <PostCreateModal />
    </div>
  );
}
