'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import LeftSidebar from '@/components/navigation/LeftSidebar';
import BottomNav from '@/components/navigation/BottomNav';
import CreatePostFAB from '@/components/navigation/CreatePostFAB';

export default function MainLayout({ children }) {
  const { isAuthenticated, loading, checkAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
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
              {[
                { name: 'Alice Smith', handle: 'alice' },
                { name: 'Bob Johnson', handle: 'bob' }
              ].map((item) => (
                <div key={item.handle} className="flex items-center justify-between px-2">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-850 flex items-center justify-center font-semibold text-sm shrink-0">
                      {item.name.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold truncate leading-tight">{item.name}</span>
                      <span className="text-xs text-zinc-500 truncate">@{item.handle}</span>
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-950 rounded-full text-xs font-bold hover:opacity-90 transition-opacity shrink-0">
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Widget */}
          <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
            <h3 className="font-bold text-base px-2">Trending Topics</h3>
            <div className="flex flex-col space-y-3">
              {[
                { tag: '#nextjs', posts: '12.4k posts' },
                { tag: '#tailwindcss', posts: '8.2k posts' },
                { tag: '#webdev', posts: '22.1k posts' }
              ].map((item) => (
                <div key={item.tag} className="flex flex-col px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 p-1.5 rounded-xl transition-all cursor-pointer">
                  <span className="text-sm font-bold text-zinc-850 dark:text-zinc-150">{item.tag}</span>
                  <span className="text-xs text-zinc-500">{item.posts}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </div>

      {/* Sticky Bottom Navigation Bar (Mobile only) */}
      <BottomNav />

      {/* Floating Action Button (Mobile only) */}
      <CreatePostFAB />
    </div>
  );
}
