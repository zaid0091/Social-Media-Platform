'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import useSWR from 'swr';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import LeftSidebar from '@/components/navigation/LeftSidebar';
import BottomNav from '@/components/navigation/BottomNav';
import CreatePostFAB from '@/components/navigation/CreatePostFAB';
import dynamic from 'next/dynamic';

const PostCreateModal = dynamic(() => import('@/components/posts/PostCreateModal'), {
  ssr: false
});
import SuggestedUsersWidget from '@/components/profile/SuggestedUsersWidget';
import Sparkline from '@/components/posts/Sparkline';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function MainLayout({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  // SWR queries for Right Sidebar (Trending hashtags only, suggestions moved to widget)
  const { data: trending } = useSWR(
    isAuthenticated ? '/hashtags/trending/' : null,
    fetcher
  );



  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-200">
      <div className="w-full flex min-h-screen relative">
        
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
          <SuggestedUsersWidget />

          {/* Trending Widget */}
          <div className="p-4.5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 text-left">
            <h3 className="font-black text-sm px-1 flex items-center justify-between">
              <span>Trending Today</span>
              {trending?.country && (
                <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                  {trending.country}
                </span>
              )}
            </h3>
            
            {/* Hashtags list */}
            <div className="flex flex-col space-y-3.5">
              {trending?.hashtags && trending.hashtags.length > 0 ? (
                trending.hashtags.slice(0, 10).map((item) => (
                  <Link 
                    key={item.id || item.name} 
                    href={`/search?q=${encodeURIComponent('#' + item.name)}`}
                    className="flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 p-1.5 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-black text-zinc-850 dark:text-zinc-150 truncate">
                        #{item.name}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-semibold mt-0.5">
                        {item.post_count || 0} posts
                      </span>
                    </div>
                    {item.recent_activity && (
                      <Sparkline data={item.recent_activity} width={65} height={18} />
                    )}
                  </Link>
                ))
              ) : (
                <p className="text-xs text-zinc-500 px-1 font-semibold">No trending hashtags</p>
              )}
            </div>

            {/* Trending topics (words) list */}
            {trending?.topics && trending.topics.length > 0 && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider px-1 block">
                  Trending Topics
                </span>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {trending.topics.map((topic) => (
                    <Link
                      key={topic.name}
                      href={`/search?q=${encodeURIComponent(topic.name)}`}
                      className="px-2 py-1 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800 text-[10px] font-black text-zinc-600 dark:text-zinc-350 rounded-lg transition"
                    >
                      {topic.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
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
