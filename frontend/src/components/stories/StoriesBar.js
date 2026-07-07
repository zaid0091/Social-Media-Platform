'use client';

import { useState } from 'react';
import useAuthStore from '@/store/useAuthStore';
import useStories from '@/hooks/useStories';
import StoryCreateModal from './StoryCreateModal';
import StoryViewer from './StoryViewer';
import { Plus } from 'lucide-react';

export default function StoriesBar() {
  const { user: currentUser } = useAuthStore();
  const [viewerIndex, setViewerIndex] = useState(null); // Index of active group to view
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Fetch active stories list grouped by author using React Query
  const { data: storyGroups = [], refetch: refetchStories } = useStories();

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

  const ownGroupIndex = storyGroups.findIndex(g => g.author.username === currentUser?.username);
  const hasOwnStories = ownGroupIndex !== -1;
  const ownGroup = hasOwnStories ? storyGroups[ownGroupIndex] : null;
  const ownStoriesUnviewed = ownGroup ? hasUnviewedStories(ownGroup) : false;


  return (
    <div className="w-full border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/20 dark:bg-zinc-900/20 py-4 px-4 overflow-hidden relative select-none">
      <div className="flex space-x-4 overflow-x-auto scrollbar-none">
        
        {/* 1. Current User story bubble with upload trigger */}
        <div className="flex flex-col items-center space-y-1.5 shrink-0">
          <div className="relative group">
            <button 
              onClick={() => {
                if (hasOwnStories) {
                  handleOpenViewer(ownGroupIndex);
                } else {
                  setIsCreateOpen(true);
                }
              }}
              className={`h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                hasOwnStories 
                  ? ownStoriesUnviewed 
                    ? 'bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-[2.5px]' 
                    : 'border border-zinc-300 dark:border-zinc-800 p-[2px]'
                  : 'border-2 border-dashed border-zinc-300 dark:border-zinc-800 p-[2px]'
              }`}
            >
              <div className="h-full w-full rounded-full border-2 border-white dark:border-zinc-900 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                {currentUser?.profile_picture ? (
                  <img 
                    src={currentUser.profile_picture} 
                    alt="Your Story" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 text-sm group-hover:scale-105 transition-transform">
                    {currentUser?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </button>
            
            {/* Absolute overlay blue Plus sign button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsCreateOpen(true);
              }}
              className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary hover:bg-primary-hover text-white rounded-full border border-white dark:border-zinc-900 flex items-center justify-center shadow cursor-pointer transition-colors"
            >
              <Plus className="h-3 w-3 stroke-[3]" />
            </button>
          </div>
          
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold">Your Story</span>
        </div>

        {/* 2. Grouped Followed profiles story circles */}
        {storyGroups.filter(g => g.author.username !== currentUser?.username).map((group) => {
          // Re-map index because we filtered out own story group
          const actualIndex = storyGroups.findIndex(g => g.author.username === group.author.username);
          const unviewed = hasUnviewedStories(group);
          return (
            <div key={group.author.id} className="flex flex-col items-center space-y-1.5 shrink-0">
              <button
                onClick={() => handleOpenViewer(actualIndex)}
                className={`h-14 w-14 rounded-full flex items-center justify-center cursor-pointer transform hover:scale-105 transition-all ${
                  unviewed 
                    ? 'bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-[2.5px]' 
                    : 'border border-zinc-300 dark:border-zinc-800 p-[2px]'
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
          onStoryViewed={() => refetchStories()} // refetch and fetch viewed status checks
        />
      )}

      {/* 4. Story Create Modal */}
      <StoryCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onStoryCreated={() => refetchStories()}
      />
    </div>
  );
}
