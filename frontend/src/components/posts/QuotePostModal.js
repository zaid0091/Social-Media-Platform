'use client';

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import api from '@/services/api';
import RepostCard from './RepostCard';

export default function QuotePostModal({ isOpen, post, onClose, onSuccess }) {
  const [commentary, setCommentary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !post) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commentary.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post(`/posts/${post.id}/quote/`, {
        content: commentary.trim()
      });
      if (onSuccess) onSuccess(res.data);
      setCommentary('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to quote post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 relative flex flex-col text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Quote Post</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto max-h-[80vh] pr-1">
          {error && (
            <p className="text-[10px] text-red-500 font-bold leading-none">{error}</p>
          )}

          <div className="flex flex-col space-y-1">
            <textarea
              autoFocus
              required
              rows={4}
              maxLength={280}
              placeholder="Add your commentary..."
              value={commentary}
              onChange={(e) => setCommentary(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 font-semibold resize-none"
            />
            <div className="flex justify-end text-[10px] text-zinc-400 font-bold">
              {280 - commentary.length} characters left
            </div>
          </div>

          {/* Nest the original post preview */}
          <RepostCard post={post} />

          {/* Footer actions */}
          <div className="flex justify-end space-x-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-xs font-black text-zinc-600 dark:text-zinc-400 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !commentary.trim()}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-black shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:bg-zinc-250 dark:disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Posting...</span>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Post Quote</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
