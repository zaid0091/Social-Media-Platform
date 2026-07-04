'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, User, Settings, RefreshCw, ChevronDown } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleKeyDownTrigger = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDropdown();
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        onClick={toggleDropdown}
        onKeyDown={handleKeyDownTrigger}
        className="w-full flex items-center justify-between p-2 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left group cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="User Account Menu"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0 shadow-md">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm leading-tight text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-zinc-50 truncate">
              {user?.full_name || user?.username}
            </span>
            <span className="text-xs text-zinc-500 truncate">
              @{user?.username}
            </span>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-1.5 flex flex-col space-y-0.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          role="menu"
          aria-label="User Actions"
        >
          {/* View Profile */}
          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-50 transition-all font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            role="menuitem"
          >
            <User className="h-4 w-4 text-zinc-500" />
            <span>View Profile</span>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-50 transition-all font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            role="menuitem"
          >
            <Settings className="h-4 w-4 text-zinc-500" />
            <span>Settings</span>
          </Link>

          {/* Switch Account */}
          <button
            onClick={() => {
              setIsOpen(false);
              alert('Switch account functionality placeholder');
            }}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-50 transition-all font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left cursor-pointer"
            role="menuitem"
          >
            <RefreshCw className="h-4 w-4 text-zinc-500" />
            <span>Switch Account</span>
          </button>

          {/* Log Out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 transition-all font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 text-left border-t border-zinc-100 dark:border-zinc-800 mt-1.5 pt-2 cursor-pointer"
            role="menuitem"
          >
            <LogOut className="h-4 w-4 text-red-500" />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
