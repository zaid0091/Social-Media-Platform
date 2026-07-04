'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { X, Check, Search, Calendar, FolderHeart } from 'lucide-react';
import api from '@/services/api';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function HighlightCreateModal({ isOpen, onClose, onHighlightCreated }) {
  const [title, setTitle] = useState('');
  const [selectedStoryIds, setSelectedStoryIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch all stories created by the user (archive)
  const { data: archive = [], error: archiveError, isLoading } = useSWR(
    isOpen ? '/stories/archive/' : null,
    fetcher
  );

  if (!isOpen) return null;

  const handleToggleSelect = (storyId) => {
    setSelectedStoryIds((prev) => 
      prev.includes(storyId) 
        ? prev.filter(id => id !== storyId) 
        : [...prev, storyId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the highlight.');
      return;
    }
    if (selectedStoryIds.length === 0) {
      setError('Please select at least one story for the highlight.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Find the first selected story to use its media_url as the default cover
      const coverStory = archive.find(s => s.id === selectedStoryIds[0]);
      const coverImage = coverStory ? coverStory.media_url : '';

      const payload = {
        title: title.trim(),
        cover_image: coverImage,
        stories: selectedStoryIds
      };

      await api.post('/stories/highlights/create/', payload);
      onHighlightCreated();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create highlight. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setSelectedStoryIds([]);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal card */}
      <form 
        onSubmit={handleSubmit}
        className="relative w-full max-w-md h-full sm:h-[80vh] sm:max-h-[600px] bg-zinc-950 text-white flex flex-col overflow-hidden sm:rounded-2xl border border-zinc-800 shadow-2xl"
      >
        
        {/* Header */}
        <header className="p-4 border-b border-zinc-850 flex items-center justify-between shrink-0 bg-zinc-900/40">
          <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center space-x-2">
            <FolderHeart className="h-4.5 w-4.5 text-primary" />
            <span>New Highlight</span>
          </h3>
          <button 
            type="button"
            onClick={handleClose} 
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Errors */}
        {error && (
          <div className="p-3 bg-red-950/40 border-b border-red-900/50 text-red-400 text-xs shrink-0">
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col space-y-5">
          
          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Highlight Title</label>
            <input 
              type="text" 
              placeholder="e.g. Summer 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={30}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-white transition-all"
              autoFocus
            />
          </div>

          {/* Stories List */}
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Select Stories ({selectedStoryIds.length} chosen)</label>
            
            <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-900/20 border border-zinc-850 rounded-xl p-3 scrollbar-none">
              {isLoading ? (
                <div className="h-full flex items-center justify-center py-10">
                  <div className="h-6 w-6 rounded-full border-2 border-zinc-800 border-t-primary animate-spin" />
                </div>
              ) : archiveError ? (
                <p className="text-center text-xs text-zinc-500 py-10">Failed to load story archive.</p>
              ) : archive.length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-10">You do not have any posted stories yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {archive.map((story) => {
                    const isSelected = selectedStoryIds.includes(story.id);
                    return (
                      <div 
                        key={story.id}
                        onClick={() => handleToggleSelect(story.id)}
                        className={`aspect-[9/16] relative bg-zinc-950 rounded-lg overflow-hidden border-2 cursor-pointer transition ${
                          isSelected ? 'border-primary' : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {/* Media display */}
                        {story.media_type === 'video' ? (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <video src={story.media_url} className="w-full h-full object-cover opacity-60" muted />
                          </div>
                        ) : (
                          <img src={story.media_url} alt="Story" className="w-full h-full object-cover opacity-60" />
                        )}

                        {/* Top overlay checkbox checkbox */}
                        <div className={`absolute top-1.5 right-1.5 h-4.5 w-4.5 rounded-full border flex items-center justify-center transition ${
                          isSelected ? 'bg-primary border-primary text-white' : 'border-white/50 bg-black/40'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>

                        {/* Relative timestamp label */}
                        <div className="absolute bottom-1 inset-x-1 py-0.5 px-1 bg-black/50 rounded text-[8px] font-bold text-zinc-350 text-center truncate">
                          {new Date(story.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-zinc-900 shrink-0 bg-zinc-900/20">
          <button
            type="submit"
            disabled={submitting || !title.trim() || selectedStoryIds.length === 0}
            className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold rounded-xl transition shadow shadow-primary/25 cursor-pointer"
          >
            {submitting ? 'Creating Highlight...' : 'Create Highlight'}
          </button>
        </footer>
      </form>
    </div>
  );
}
