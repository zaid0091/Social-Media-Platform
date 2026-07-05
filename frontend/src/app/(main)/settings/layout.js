'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, ShieldCheck, Lock, Bell, Key, Paintbrush, HelpCircle } from 'lucide-react';

export default function SettingsLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { label: 'Edit Profile', href: '/settings/profile', icon: User },
    { label: 'Account Info', href: '/settings/account', icon: ShieldCheck },
    { label: 'Privacy & Safety', href: '/settings/privacy', icon: Lock },
    { label: 'Notifications', href: '/settings/notifications', icon: Bell },
    { label: 'Security & Access', href: '/settings/security', icon: Key },
    { label: 'Appearance', href: '/settings/appearance', icon: Paintbrush },
    { label: 'Help & Support', href: '/settings/help', icon: HelpCircle },
  ];

  const isRoot = pathname === '/settings' || pathname === '/settings/';

  // Get active menu label for mobile back navigation bar title
  const activeItem = menuItems.find((item) => item.href === pathname);
  const pageTitle = activeItem ? activeItem.label : 'Settings';

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      
      {/* MOBILE HEADER: back button to settings index (only shown on mobile sub-pages) */}
      {!isRoot && (
        <header className="md:hidden sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center space-x-3.5 text-left">
          <button
            onClick={() => router.push('/settings')}
            className="p-2 hover:bg-zinc-105 dark:hover:bg-zinc-800 rounded-xl text-zinc-650 dark:text-zinc-350 transition cursor-pointer"
            aria-label="Back to settings menu"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <span className="text-sm font-black text-zinc-900 dark:text-zinc-50 leading-tight">
            {pageTitle}
          </span>
        </header>
      )}

      {/* Main layout container split columns */}
      <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row md:space-x-6 md:p-6 text-left flex-1">
        
        {/* LEFT COLUMN: Settings Menu Navigation (Desktop only) */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-4 shadow-sm h-fit space-y-2 select-none">
          <h2 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider px-3 mb-2">Settings Menu</h2>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-2xl transition font-black text-[11px] ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </aside>

        {/* RIGHT COLUMN: Active settings page content */}
        <main className={`flex-1 min-w-0 bg-white dark:bg-zinc-900 md:border md:border-zinc-200/50 md:dark:border-zinc-800 md:rounded-3xl md:shadow-sm ${isRoot ? 'hidden md:block' : 'block'}`}>
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
