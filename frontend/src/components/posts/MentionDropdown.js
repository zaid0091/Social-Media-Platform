'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import api from '@/services/api';

export default function MentionDropdown({ query, onSelect, onClose, className = '' }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(handler);
  }, [query]);

  // Fetch suggestions
  const { data, error, isLoading } = useSWR(
    debouncedQuery !== null && debouncedQuery !== undefined ? `/search/users/?q=${encodeURIComponent(debouncedQuery)}` : null,
    (url) => api.get(url).then((res) => res.data.results || []),
    { keepPreviousData: true }
  );

  const suggestions = data || [];

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(suggestions[selectedIndex].username);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [suggestions, selectedIndex, onSelect, onClose]);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.mention-dropdown')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (error) return null;
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <div 
      className={`mention-dropdown absolute left-0 right-0 z-50 max-h-48 overflow-y-auto bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg ${className}`}
    >
      {isLoading && suggestions.length === 0 ? (
        <div className="px-4 py-3 text-xs text-zinc-400 font-medium">Searching users...</div>
      ) : (
        suggestions.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.username)}
            className={`w-full text-left px-4 py-2.5 flex items-center space-x-3 transition-colors cursor-pointer ${
              index === selectedIndex 
                ? 'bg-primary/10 text-primary dark:bg-zinc-800' 
                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            {item.profile_picture ? (
              <img 
                src={item.profile_picture} 
                alt={item.username} 
                className="h-7 w-7 rounded-full object-cover shrink-0" 
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-[10px] shrink-0">
                {item.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold leading-tight truncate">@{item.username}</span>
              {item.full_name && (
                <span className="text-[10px] text-zinc-400 font-semibold truncate leading-none mt-0.5">
                  {item.full_name}
                </span>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
