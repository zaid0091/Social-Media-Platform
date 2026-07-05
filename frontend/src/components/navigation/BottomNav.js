'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import useNotificationStore from '@/store/useNotificationStore';
import { Home, Search, Bell, Mail, User, UserPlus } from 'lucide-react';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function BottomNav() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const { user: currentUser } = useAuthStore();

  const { data: requestsData } = useSWR(
    currentUser?.is_private ? '/users/follow-requests/' : null,
    fetcher,
    { refreshInterval: 20000 }
  );

  const pendingRequestsCount = requestsData?.count || 0;

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
    ...(currentUser?.is_private ? [{
      href: '/follow-requests',
      icon: UserPlus,
      label: 'Requests',
      badge: pendingRequestsCount
    }] : []),
    { href: '/messages', icon: Mail, label: 'Messages' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around z-40 px-2"
      aria-label="Mobile Navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center p-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isActive ? 'text-primary' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <div className="relative">
              <Icon className={`h-6 w-6 transition-transform ${isActive ? 'scale-105' : ''}`} />
              
              {/* Badge */}
              {item.badge > 0 && (
                <span 
                  key={item.badge}
                  className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 animate-badge-pop"
                  aria-label={`${item.badge} unread notifications`}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
