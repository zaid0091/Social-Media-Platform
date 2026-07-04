'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { X, Check, Trash2, Calendar, FolderHeart } from 'lucide-react';
import api from '@/services/api';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function HighlightEditModal({ isOpen, onClose, highlight, onHighlightUpdated }) {
  const [title, setTitle] = useState('');
  const [selectedStoryIds, setSelectedStoryIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Fetch all stories created by the user (archive)
  const { data: archive = [], error: archiveError, isLoading } = useSWR(
    isOpen ? '/stories/archive/' : null,
    fetcher
  );

  // Initialize form values from highlights metadata
  useEffect(() => {
    if (highlight) {
      setTitle(highlight.title || '');
      setSelectedStoryIds(highlight.stories?.map((s) => s.id) || []);
    }
  }, [highlight, isOpen]);

  if (!isOpen || !highlight) return null;

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
      setError('Please select at least one story.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Find the first selected story to use its media_url as the updated cover
      const coverStory = archive.find(s => s.id === selectedStoryIds[0]) || highlight.stories?.find(s => s.id === selectedStoryIds[0]);
      const coverImage = coverStory ? coverStory.media_url : highlight.cover_image;

      const payload = {
        title: title.trim(),
        cover_image: coverImage,
        stories: selectedStoryIds
      };

      await api.patch(`/stories/highlights/${highlight.id}/update/`, payload);
      onHighlightUpdated();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update highlight.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(`Are you sure you want to delete highlight "${highlight.title}"?`);
    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      await api.delete(`/stories/highlights/${highlight.id}/delete/`);
      onHighlightUpdated();
      handleClose();
    } catch (err) {
      setError('Failed to delete highlight.');
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Card wrapper */}
      <form 
        onSubmit={handleSubmit}
        className="relative w-full max-w-md h-full sm:h-[80vh] sm:max-h-[600px] bg-zinc-950 text-white flex flex-col overflow-hidden sm:rounded-2xl border border-zinc-800 shadow-2xl"
      >
        
        {/* Header */}
        <header className="p-4 border-b border-zinc-850 flex items-center justify-between shrink-0 bg-zinc-900/40">
          <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center space-x-2">
            <FolderHeart className="h-4.5 w-4.5 text-primary" />
            <span>Edit Highlight</span>
          </h3>
          <button 
            type="button"
            onClick={handleClose} 
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Error bar */}
        {error && (
          <div className="p-3 bg-red-950/40 border-b border-red-900/50 text-red-400 text-xs shrink-0">
            <span>{error}</span>
          </div>
        )}

        {/* Form Body content scroll panel */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col space-y-5">
          
          {/* Edit Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Highlight Title</label>
            <input 
              type="text" 
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={30}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-white transition-all"
            />
          </div>

          {/* Edit stories checklist */}
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <label className="text-xs font-black uppercase text-zinc-400 tracking-wider">Select Stories ({selectedStoryIds.length} chosen)</label>
            
            <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-900/20 border border-zinc-850 rounded-xl p-3 scrollbar-none">
              {isLoading ? (
                <div className="h-full flex items-center justify-center py-10">
                  <div className="h-6 w-6 rounded-full border-2 border-zinc-800 border-t-primary animate-spin" />
                </div>
              ) : archiveError ? (
                <p className="text-center text-xs text-zinc-500 py-10">Failed to load stories.</p>
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

                        {/* Selection check box overlay indicator */}
                        <div className={`absolute top-1.5 right-1.5 h-4.5 w-4.5 rounded-full border flex items-center justify-center transition ${
                          isSelected ? 'bg-primary border-primary text-white' : 'border-white/50 bg-black/40'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>

                        {/* Timestamp tag overlay */}
                        <div className="absolute bottom-1 inset-x-1 py-0.5 px-1 bg-black/50 rounded text-[8px] font-bold text-zinc-300 text-center truncate">
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

        {/* Footer actions containing update and delete triggers */}
        <footer className="p-4 border-t border-zinc-900 shrink-0 bg-zinc-900/20 flex items-center justify-between space-x-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || submitting}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-red-950/40 text-red-500 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shrink-0 select-none"
            aria-label="Delete Highlight"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          
          <button
            type="submit"
            disabled={submitting || deleting || !title.trim() || selectedStoryIds.length === 0}
            className="flex-1 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold rounded-xl transition shadow shadow-primary/25 cursor-pointer select-none"
          >
            {submitting ? 'Saving changes...' : 'Save Changes'}
          </button>
        </footer>
      </form>
    </div>
  );
}
