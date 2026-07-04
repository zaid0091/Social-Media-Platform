'use client';

import { useState } from 'react';
import useSWR from 'swr';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import StoryViewer from './StoryViewer';
import { Plus } from 'lucide-react';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function StoriesBar({ onCreateStory }) {
  const { user: currentUser } = useAuthStore();
  const [viewerIndex, setViewerIndex] = useState(null); // Index of active group to view

  // Fetch active stories list grouped by author
  const { data: storyGroups = [], mutate: mutateStories } = useSWR('/stories/', fetcher);

  const handleOpenViewer = (index) => {
    setViewerIndex(index);
  };

  const handleCloseViewer = () => {
    setViewerIndex(null);
  };

  // Helper check to see if an author has unviewed stories
  const hasUnviewedStories = (group) => {
    return group.stories.some((story) => !story.is_viewed_by_me);
  };

  return (
    <div className="w-full border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/20 dark:bg-zinc-900/20 py-4 px-4 overflow-hidden relative select-none">
      <div className="flex space-x-4 overflow-x-auto scrollbar-none">
        
        {/* 1. Current User story bubble with upload trigger */}
        <div className="flex flex-col items-center space-y-1.5 shrink-0">
          <button 
            onClick={onCreateStory}
            className="h-14 w-14 rounded-full p-[2px] border-2 border-dashed border-zinc-300 dark:border-zinc-800 hover:border-primary flex items-center justify-center bg-white dark:bg-zinc-900 relative group cursor-pointer"
          >
            {currentUser?.profile_picture ? (
              <img 
                src={currentUser.profile_picture} 
                alt="Your Story" 
                className="h-12 w-12 rounded-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 text-sm group-hover:scale-105 transition-transform">
                {currentUser?.username?.charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Absolute overlay blue Plus sign button */}
            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary text-white rounded-full border border-white dark:border-zinc-900 flex items-center justify-center shadow">
              <Plus className="h-3 w-3 stroke-[3]" />
            </div>
          </button>
          
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold">Your Story</span>
        </div>

        {/* 2. Grouped Followed profiles story circles */}
        {storyGroups.map((group, index) => {
          const unviewed = hasUnviewedStories(group);
          return (
            <div key={group.author.id} className="flex flex-col items-center space-y-1.5 shrink-0">
              <button
                onClick={() => handleOpenViewer(index)}
                className={`h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transform hover:scale-105 transition-all ${
                  unviewed 
                    ? 'bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-[2.5px]' 
                    : 'border border-zinc-250 dark:border-zinc-800 p-[2px]'
                }`}
              >
                <div className="h-full w-full rounded-full border-2 border-white dark:border-zinc-900 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {group.author.profile_picture ? (
                    <img 
                      src={group.author.profile_picture} 
                      alt={group.author.username} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs">
                      {group.author.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </button>
              
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold truncate max-w-[65px]">
                {group.author.username}
              </span>
            </div>
          );
        })}
      </div>

      {/* 3. Story Viewer Modal Overlay */}
      {viewerIndex !== null && (
        <StoryViewer
          groups={storyGroups}
          initialGroupIndex={viewerIndex}
          onClose={handleCloseViewer}
          onStoryViewed={() => mutateStories()} // mutate and fetch viewed status checks
        />
      )}
    </div>
  );
}
