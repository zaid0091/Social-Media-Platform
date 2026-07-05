'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, User, ShieldCheck, Lock, Bell, Key, Paintbrush, HelpCircle } from 'lucide-react';

export default function SettingsBasePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile settings on desktop widths
    if (window.innerWidth >= 768) {
      router.replace('/settings/profile');
    }
  }, [router]);

  const menuItems = [
    { label: 'Edit Profile', href: '/settings/profile', icon: User, desc: 'Change avatar, bio, location, and gender' },
    { label: 'Account Info', href: '/settings/account', icon: ShieldCheck, desc: 'Update username, email, phone, and connected accounts' },
    { label: 'Privacy Control', href: '/settings/privacy', icon: Lock, desc: 'Manage private accounts, block lists, comments' },
    { label: 'Notifications', href: '/settings/notifications', icon: Bell, desc: 'Configure push notifications, email and in-app alerts' },
    { label: 'Security Center', href: '/settings/security', icon: Key, desc: 'Update passwords, sessions, login devices' },
    { label: 'Appearance', href: '/settings/appearance', icon: Paintbrush, desc: 'Manage themes, mode types, font styles' },
    { label: 'Help & Support', href: '/settings/help', icon: HelpCircle, desc: 'Report a problem, help center articles' },
  ];

  return (
    <div className="md:hidden flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 text-left">
      <div className="mb-5">
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Settings</h1>
        <p className="text-[10px] text-zinc-400 font-semibold mt-0.5 leading-none">Manage profiles, safety, and themes preferences</p>
      </div>
      
      <div className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/80 rounded-2.5xl shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-850 transition"
            >
              <div className="flex items-center space-x-3.5 min-w-0 mr-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 leading-tight">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold truncate leading-none mt-1">
                    {item.desc}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
