'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Volume2, VolumeX, Heart, ChevronLeft, ChevronRight, FolderHeart, Eye } from 'lucide-react';
import useSWR from 'swr';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import StoryViewerList from './StoryViewerList';

export default function StoryViewer({ groups = [], initialGroupIndex = 0, onClose, onStoryViewed }) {
  const { user: currentUser } = useAuthStore();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);

  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(5); // Default to 5s for images
  const [reactAnimate, setReactAnimate] = useState(false);

  const videoRef = useRef(null);
  const progressTimerRef = useRef(null);

  const activeGroup = groups[groupIndex];
  const activeStory = activeGroup?.stories[storyIndex];

  const [showHighlightPopover, setShowHighlightPopover] = useState(false);
  const isOwnStory = activeGroup?.author?.id === currentUser?.id;
  const [isViewerListOpen, setIsViewerListOpen] = useState(false);

  // Fetch highlights of this profile to support adding
  const { data: ownHighlights = [], mutate: mutateOwnHighlights } = useSWR(
    isOwnStory && currentUser?.username ? `/stories/highlights/user/${currentUser.username}/` : null,
    (url) => api.get(url).then(r => r.data).catch(() => [])
  );

  // Auto-reset story index when switching group index
  useEffect(() => {
    setStoryIndex(0);
  }, [groupIndex]);

  // Sync video duration or set 5 seconds default for images
  useEffect(() => {
    if (!activeStory) return;

    setProgress(0);
    if (activeStory.media_type === 'video') {
      // Handled in onLoadedMetadata of the video tag
      setVideoDuration(0); 
    } else {
      setVideoDuration(5); // 5s for images
    }

    // Call view endpoint if not yet viewed by me
    if (!activeStory.is_viewed_by_me) {
      markStoryAsViewed(activeStory.id);
    }
  }, [storyIndex, groupIndex]);

  // Progress Bar timer logic
  useEffect(() => {
    if (isPaused || !activeStory || videoDuration === 0) return;

    const tickInterval = 30; // update progress every 30ms
    const totalDurationMs = videoDuration * 1000;
    const progressStep = (tickInterval / totalDurationMs) * 100;

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + progressStep;
      });
    }, tickInterval);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [storyIndex, groupIndex, isPaused, videoDuration]);

  // Handle video playback mapping pause states
  useEffect(() => {
    if (videoRef.current && activeStory?.media_type === 'video') {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, storyIndex, groupIndex]);

  if (!activeGroup || !activeStory) return null;

  const markStoryAsViewed = async (storyId) => {
    try {
      await api.post(`/stories/${storyId}/view/`);
      // Trigger parent SWR reload
      if (onStoryViewed) onStoryViewed(storyId);
    } catch (err) {}
  };

  const handleNext = () => {
    if (storyIndex < activeGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((prev) => prev + 1);
    } else {
      onClose(); // Closed viewer if all stories exhausted
    }
  };

  const handlePrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
    } else if (groupIndex > 0) {
      // Go to previous user's last story
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setTimeout(() => {
        setStoryIndex(prevGroup.stories.length - 1);
      }, 50);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [storyIndex, groupIndex, groups]);

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration || 5);
      if (!isPaused) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handleReactClick = () => {
    setReactAnimate(true);
    setTimeout(() => setReactAnimate(false), 800);
  };

  const handleAddToHighlight = async (highlight) => {
    try {
      const updatedStoryIds = [...highlight.stories.map(s => s.id), activeStory.id];
      await api.patch(`/stories/highlights/${highlight.id}/update/`, {
        stories: updatedStoryIds
      });
      mutateOwnHighlights();
      setShowHighlightPopover(false);
      setIsPaused(false);
      alert(`Story successfully added to "${highlight.title}"!`);
    } catch (err) {
      alert('Failed to add story to highlight.');
    }
  };

  const handleCreateHighlightFromStory = async () => {
    const title = window.prompt("Enter new highlight title:");
    if (!title || !title.trim()) return;

    try {
      await api.post('/stories/highlights/create/', {
        title: title.trim(),
        cover_image: activeStory.media_url,
        stories: [activeStory.id]
      });
      mutateOwnHighlights();
      setShowHighlightPopover(false);
      setIsPaused(false);
      alert(`Highlight "${title}" created successfully!`);
    } catch (err) {
      alert('Failed to create highlight.');
    }
  };

  const touchStartY = useRef(null);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleTouchEnd = (e) => {
    setIsPaused(false);
    if (touchStartY.current !== null) {
      const touchEndY = e.changedTouches[0].clientY;
      const diffY = touchStartY.current - touchEndY;
      if (isOwnStory && diffY > 80) {
        setIsPaused(true);
        setIsViewerListOpen(true);
      }
      touchStartY.current = null;
    }
  };

  const timeAgoString = () => {
    const diffMs = new Date() - new Date(activeStory.created_at);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    return `${diffHrs}h ago`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex items-center justify-center select-none"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {/* Container holding full screen media */}
      <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-zinc-950 flex flex-col justify-between shadow-2xl">
        
        {/* Tap areas overlay */}
        <div className="absolute inset-0 z-20 flex">
          {/* Left tap area (navigate backward) */}
          <div 
            onClick={handlePrev}
            className="w-1/3 h-full cursor-w-resize" 
          />
          {/* Middle hold to pause area */}
          <div 
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="w-1/3 h-full"
          />
          {/* Right tap area (navigate forward) */}
          <div 
            onClick={handleNext}
            className="w-1/3 h-full cursor-e-resize" 
          />
        </div>

        {/* Top items: Progress bars and Author header info overlay */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent z-30 flex flex-col space-y-3">
          {/* Progress Indicators */}
          <div className="flex space-x-1.5 w-full">
            {activeGroup.stories.map((item, index) => {
              let fillWidth = '0%';
              if (index < storyIndex) fillWidth = '100%';
              else if (index === storyIndex) fillWidth = `${progress}%`;

              return (
                <div key={item.id} className="h-1 bg-white/30 rounded-full flex-1 overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-30 ease-linear"
                    style={{ width: fillWidth }}
                  />
                </div>
              );
            })}
          </div>

          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              {activeGroup.author.profile_picture ? (
                <img 
                  src={activeGroup.author.profile_picture} 
                  alt={activeGroup.author.username} 
                  className="h-8 w-8 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs">
                  {activeGroup.author.username?.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div className="flex flex-col text-left">
                <span className="font-extrabold text-sm text-white">{activeGroup.author.username}</span>
                <span className="text-[10px] text-white/70 font-semibold">{timeAgoString()}</span>
              </div>
            </div>

            {/* Mute and Close Overlay controls */}
            <div className="flex items-center space-x-2 z-30">
              {activeStory.media_type === 'video' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white cursor-pointer select-none"
                  aria-label="Mute Video"
                >
                  {isMuted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
                </button>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white cursor-pointer select-none"
                aria-label="Close Viewer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Media screen */}
        <div className="flex-1 w-full h-full flex items-center justify-center bg-zinc-950">
          {activeStory.media_type === 'video' ? (
            <video
              ref={videoRef}
              src={activeStory.media_url}
              onLoadedMetadata={handleVideoLoaded}
              onEnded={handleNext}
              muted={isMuted}
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={activeStory.media_url}
              alt="Story Slide"
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Heart reaction anim layer overlay */}
        {reactAnimate && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40">
            <Heart className="h-28 w-28 text-red-500 fill-red-500 animate-ping duration-700 opacity-80" />
          </div>
        )}

        {/* Bottom Caption and Heart Reaction Row */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-30 flex flex-col space-y-3">
          <div className="flex items-end justify-between space-x-4">
            {/* Caption */}
            <p className="text-white text-sm leading-relaxed text-left flex-1 break-words select-text">
              {activeStory.caption}
            </p>
            
            {/* View count pill (Only for own active stories) */}
            {isOwnStory && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(true); // Pause stories progression while viewers drawer is open
                  setIsViewerListOpen(true);
                }}
                className="px-3 py-1.5 rounded-full bg-black/45 hover:bg-black/60 text-white backdrop-blur-md cursor-pointer select-none text-xs font-bold flex items-center space-x-1.5 z-35 mr-auto mb-1 shrink-0 border border-white/10 transition-colors"
                aria-label="View Story Viewers"
              >
                <Eye className="h-3.5 w-3.5 text-zinc-350" />
                <span>{activeStory.view_count || 0}</span>
              </button>
            )}

            {/* Folder Heart Add-to-Highlight Action */}
            {isOwnStory && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused(true); // Pause stories progression while dropdown is open
                    setShowHighlightPopover(!showHighlightPopover);
                  }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md cursor-pointer select-none shrink-0 mb-1 z-35 flex items-center justify-center"
                  aria-label="Add to Highlight"
                >
                  <FolderHeart className="h-5 w-5 hover:text-primary transition-colors" />
                </button>

                {showHighlightPopover && (
                  <div 
                    className="absolute bottom-12 right-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 z-50 flex flex-col space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150"
                    onClick={(e) => e.stopPropagation()} // Stop propagation to prevent tap area trigger
                  >
                    <div className="text-[10px] font-black uppercase text-zinc-550 px-2 py-1 tracking-wider border-b border-zinc-800/80">
                      Add to Highlight
                    </div>
                    
                    <div className="max-h-32 overflow-y-auto flex flex-col py-1 scrollbar-none">
                      {ownHighlights && ownHighlights.map((hl) => (
                        <button
                          key={hl.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToHighlight(hl);
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-zinc-800 rounded-lg text-xs font-semibold truncate transition-colors text-white"
                        >
                          {hl.title}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateHighlightFromStory();
                      }}
                      className="w-full text-left px-2 py-1.5 bg-zinc-950 hover:bg-zinc-850 rounded-lg text-xs font-bold text-primary transition-colors border-t border-zinc-800/80 pt-2 mt-1"
                    >
                      + New Highlight
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHighlightPopover(false);
                        setIsPaused(false); // Resume stories progression
                      }}
                      className="w-full text-center px-2 py-1 hover:bg-zinc-800 text-[10px] text-zinc-500 font-bold rounded-lg mt-1"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Heart React Action */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReactClick();
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md cursor-pointer select-none shrink-0 mb-1 z-35"
              aria-label="Like Story"
            >
              <Heart className="h-5 w-5 hover:fill-red-500 hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Left/Right Navigation chevron button tabs */}
      {groupIndex > 0 && (
        <button
          onClick={handlePrev}
          className="absolute left-8 hidden md:flex items-center justify-center p-3 rounded-full bg-zinc-900/60 hover:bg-zinc-900/90 text-white cursor-pointer select-none z-30"
          aria-label="Previous user stories"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {groupIndex < groups.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-8 hidden md:flex items-center justify-center p-3 rounded-full bg-zinc-900/60 hover:bg-zinc-900/90 text-white cursor-pointer select-none z-30"
          aria-label="Next user stories"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      {/* Viewer List bottom-drawer panel */}
      {isViewerListOpen && (
        <StoryViewerList
          storyId={activeStory.id}
          isOpen={isViewerListOpen}
          onClose={() => {
            setIsViewerListOpen(false);
            setIsPaused(false); // Resume stories progression
          }}
        />
      )}
    </div>
  );
}
