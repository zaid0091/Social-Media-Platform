'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { X, Eye, Clock, UserCheck } from 'lucide-react';
import api from '@/services/api';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function StoryViewerList({ storyId, isOpen, onClose }) {
  const drawerRef = useRef(null);

  // Fetch story viewers with pagination support
  const { data: viewerData, error, isLoading } = useSWR(
    isOpen && storyId ? `/stories/${storyId}/viewers/` : null,
    fetcher
  );

  const viewers = viewerData?.results || [];
  const totalCount = viewerData?.count || 0;

  useEffect(() => {
    // Escape key press handler
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatViewTime = (timestamp) => {
    if (!timestamp) return '';
    const diffMs = new Date() - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      
      {/* Backdrop tap dismisser */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Body Container */}
      <div 
        ref={drawerRef}
        className="absolute bottom-0 inset-x-0 bg-zinc-950 text-white rounded-t-3xl border-t border-zinc-800/80 max-h-[60%] flex flex-col overflow-hidden shadow-2xl z-50 transform translate-y-0 transition-transform duration-300 animate-in slide-in-from-bottom duration-300"
      >
        
        {/* Visual drag handle indicator */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full" />
        </div>

        {/* Drawer Header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-900 shrink-0">
          <div className="flex items-center space-x-2.5">
            <Eye className="h-5 w-5 text-zinc-400" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-zinc-200">
              Viewers ({totalCount})
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Content body list scroll area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-none">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-7 w-7 rounded-full border-2 border-zinc-800 border-t-primary animate-spin" />
              <p className="text-xs text-zinc-500 font-semibold">Loading viewers list...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-xs text-zinc-500 font-medium">
              Failed to load viewers database.
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <Eye className="h-10 w-10 text-zinc-700 stroke-[1.5]" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-zinc-400">No views yet</p>
                <p className="text-[10px] text-zinc-550 max-w-[200px]">Once followers view your story slide, they will be listed here.</p>
              </div>
            </div>
          ) : (
            viewers.map((view) => {
              const viewerUser = view.viewer;
              return (
                <div key={view.id} className="flex items-center justify-between p-2.5 bg-zinc-900/30 rounded-xl hover:bg-zinc-900/60 border border-zinc-900/40 transition">
                  <div className="flex items-center space-x-3.5">
                    {viewerUser.profile_picture ? (
                      <img 
                        src={viewerUser.profile_picture} 
                        alt={viewerUser.username} 
                        className="h-10 w-10 rounded-full object-cover border border-zinc-850"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm border border-zinc-800">
                        {viewerUser.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-white">{viewerUser.username}</span>
                      <span className="text-[10px] text-zinc-400 truncate max-w-[150px]">{viewerUser.full_name}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-zinc-500">
                    <Clock className="h-3 w-3" />
                    <span className="text-[10px] font-bold">{formatViewTime(view.viewed_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
