'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import api from '@/services/api';
import useNotificationStore from '@/store/useNotificationStore';
import useAuthStore from '@/store/useAuthStore';
import Logo from './Logo';
import UserDropdown from './UserDropdown';
import NewPostButton from './NewPostButton';
import ThemeToggle from '../ThemeToggle';
import { 
  Home, 
  Search, 
  Compass, 
  Bell, 
  Mail, 
  Bookmark, 
  User, 
  Settings,
  UserPlus,
  Sparkles
} from 'lucide-react';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function LeftSidebar() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const { user: currentUser } = useAuthStore();

  // Query pending follow requests only if user is private
  const { data: requestsData } = useSWR(
    currentUser?.is_private ? '/users/follow-requests/' : null,
    fetcher,
    { refreshInterval: 20000 } // Refresh every 20s
  );

  const pendingRequestsCount = requestsData?.count || 0;

  const navItems = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Search', href: '/search', icon: Search },
    { label: 'Explore', href: '/explore', icon: Compass },
    { label: 'Discover', href: '/discover', icon: Sparkles },
    { 
      label: 'Notifications', 
      href: '/notifications', 
      icon: Bell,
      badge: unreadCount
    },
    ...(currentUser?.is_private ? [{
      label: 'Requests',
      href: '/follow-requests',
      icon: UserPlus,
      badge: pendingRequestsCount
    }] : []),
    { label: 'Messages', href: '/messages', icon: Mail },
    { label: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-20 xl:w-64 h-screen sticky top-0 border-r border-zinc-200 dark:border-zinc-800 p-4 justify-between bg-white dark:bg-zinc-900/40 backdrop-blur-xl">
      <div className="flex flex-col space-y-6">
        {/* Brand Logo */}
        <div className="flex justify-center xl:justify-start">
          <Logo />
        </div>
        
        {/* Navigation list */}
        <nav className="flex flex-col space-y-1" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center xl:justify-start space-x-4 px-4 py-3.5 rounded-2xl transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-bold' 
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-950 dark:hover:text-zinc-50'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="relative flex items-center">
                  <Icon className={`h-6 w-6 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-primary' : 'text-zinc-500'
                  }`} />
                  
                  {/* Notifications Unread Count Badge */}
                  {item.badge > 0 && (
                    <span 
                      key={item.badge}
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 animate-badge-pop"
                      aria-label={`${item.badge} unread notifications`}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="hidden xl:inline text-sm font-semibold">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Action button */}
        <div className="pt-2">
          <NewPostButton />
        </div>
      </div>

      {/* User profile details dropdown & theme toggler */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex flex-col space-y-4 items-center xl:items-stretch">
        <ThemeToggle className="self-center xl:self-start w-10 h-10" />
        <UserDropdown />
      </div>
    </aside>
  );
}
