'use client';

import { useState, useEffect } from 'react';
import { Search, X, MessageSquare, ArrowRight } from 'lucide-react';
import api from '@/services/api';

export default function NewConversationModal({ isOpen, onClose, onSelectConversation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }
  }, [isOpen]);

  // Debounced search query trigger
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get(`/users/search/?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data || []);
      } catch (err) {
        console.error('Failed to search users', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleStartConversation = async (recipientId) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const response = await api.post('/messaging/conversations/create/', { recipient_id: recipientId });
      const conversation = response.data;
      if (conversation?.id) {
        onSelectConversation(conversation.id);
        onClose();
      }
    } catch (err) {
      console.error('Failed to create/get conversation', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      
      {/* Modal Card */}
      <div 
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-badge-pop"
        role="dialog"
        aria-modal="true"
        aria-label="New Message Search Modal"
      >
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-850">
          <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50 flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>New Message</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Search Input bar */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-850">
          <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
            <Search className="h-4.5 w-4.5 text-zinc-400 mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Search users by name or @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm w-full outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-0.5 text-zinc-400 hover:text-zinc-750 dark:hover:text-zinc-200 rounded-full cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search Results list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[250px] max-h-[350px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <div className="h-6 w-6 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
              <p className="text-[11px] text-zinc-400 font-semibold">Searching users...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-850/50 rounded-full text-zinc-400 mb-2">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-zinc-500">
                {searchQuery ? "No matching users found" : "Type a name or username to start"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleStartConversation(user.id)}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-950/20 border border-transparent hover:border-zinc-100 dark:hover:border-zinc-850/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    {user.profile_picture ? (
                      <img 
                        src={user.profile_picture} 
                        alt={user.username} 
                        className="h-10 w-10 rounded-full object-cover border border-zinc-200/40 dark:border-zinc-800/40"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 group-hover:text-primary transition flex items-center">
                        @{user.username}
                        {user.is_verified && (
                          <span className="inline-block h-3.5 w-3.5 bg-blue-500 rounded-full text-white flex items-center justify-center text-[7px] font-black ml-1 scale-90" title="Verified Account">✓</span>
                        )}
                      </span>
                      <span className="text-[11px] text-zinc-500 truncate">{user.full_name || 'No name'}</span>
                    </div>
                  </div>
                  <button 
                    disabled={actionLoading}
                    className="p-2 bg-zinc-50 group-hover:bg-primary text-zinc-400 group-hover:text-white rounded-xl transition cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
