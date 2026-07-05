'use client';

import { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import api from '@/services/api';

export default function CollectionCreateModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/posts/collections/', { name: name.trim() });
      if (onSuccess) onSuccess(res.data);
      setName('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create collection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 relative flex flex-col text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            <span>Create Collection</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
              Collection Name
            </label>
            <input
              type="text"
              autoFocus
              required
              maxLength={40}
              placeholder="e.g. Inspo, Recipes, Memes..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-55 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-100 font-bold"
            />
            {error && (
              <p className="text-[10px] text-red-500 font-bold mt-1 leading-none">{error}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-xs font-black text-zinc-600 dark:text-zinc-400 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-black shadow-md transition cursor-pointer disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
