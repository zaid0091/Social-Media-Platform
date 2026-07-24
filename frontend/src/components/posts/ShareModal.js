'use client';

import { useState } from 'react';
import { 
  X, 
  Copy, 
  Send, 
  SendHorizontal,
  Search,
  Check,
  Loader2,
  Share2
} from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';
import useModalAccessibility from '@/hooks/useModalAccessibility';

export default function ShareModal({ isOpen, post, onClose, onShareSuccess }) {
  const modalRef = useModalAccessibility(true, onClose);
  const [copied, setCopied] = useState(false);
  const [sharingStory, setSharingStory] = useState(false);
  const [storySuccess, setStorySuccess] = useState(false);

  // DM search & forwarding states
  const [dmSearch, setDmSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sendingDmTo, setSendingDmTo] = useState(null); // stores user ID of target

  if (!isOpen || !post) return null;

  const postUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/posts/${post.id}` 
    : '';

  // 1. Copy Link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {}
  };

  // 2. Share to Story
  const handleShareToStory = async () => {
    setSharingStory(true);
    try {
      await api.post(`/stories/reshare/${post.id}/`);
      setStorySuccess(true);
      setTimeout(() => {
        setStorySuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      alert('Failed to reshare to Story');
    } finally {
      setSharingStory(false);
    }
  };

  // 3. Forward via DM Search
  const handleDmSearchChange = async (e) => {
    const val = e.target.value;
    setDmSearch(val);

    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await api.get(`/users/search/?q=${val}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleSendDm = async (user) => {
    setSendingDmTo(user.id);
    try {
      // 1. Create or fetch conversation
      const convRes = await api.post('/messaging/conversations/create/', {
        recipient_id: user.id
      });
      const conversationId = convRes.data.id;

      // 2. Send message containing the post url link
      await api.post('/messaging/messages/', {
        conversation_id: conversationId,
        content: `Sent a post: ${postUrl}`,
        message_type: 'text'
      });

      alert(`Shared successfully with @${user.username}!`);
    } catch (err) {
      alert('Failed to send message.');
    } finally {
      setSendingDmTo(null);
    }
  };

  // 4. External shares prefilled links
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this post: ${postUrl}`)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out this post: ${postUrl}`)}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 relative flex flex-col text-left"
        role="dialog"
        aria-modal="true"
        aria-label="Share Post Options"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
            <Share2 className="h-5 w-5 text-primary" />
            <span>Share Post</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer"
            aria-label="Close share modal"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Share actions */}
        <div className="space-y-4">
          
          {/* Story & Copy links panel */}
          <div className="flex space-x-2">
            <button
              onClick={handleShareToStory}
              disabled={sharingStory || storySuccess}
              className="flex-1 py-3 px-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl flex flex-col items-center justify-center space-y-1.5 cursor-pointer text-center text-xs font-bold transition disabled:opacity-50"
            >
              {sharingStory ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : storySuccess ? (
                <Check className="h-5 w-5 text-emerald-500" />
              ) : (
                <SendHorizontal className="h-5 w-5 text-indigo-500" />
              )}
              <span>{storySuccess ? 'Added to Story!' : 'Share to Story'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex-1 py-3 px-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl flex flex-col items-center justify-center space-y-1.5 cursor-pointer text-center text-xs font-bold transition"
            >
              {copied ? <Check className="h-5 w-5 text-emerald-500 animate-bounce" /> : <Copy className="h-5 w-5 text-zinc-500" />}
              <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          {/* Social shares links */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">External Share</h4>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={twitterShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-xl text-center text-[10px] font-black transition cursor-pointer flex items-center justify-center"
              >
                Twitter / X
              </a>
              <a
                href={facebookShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-xl text-center text-[10px] font-black transition cursor-pointer flex items-center justify-center"
              >
                Facebook
              </a>
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-xl text-center text-[10px] font-black transition cursor-pointer flex items-center justify-center"
              >
                WhatsApp
              </a>
            </div>
          </div>

          {/* Direct Message (Send to Specific User) list */}
          <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Send via Direct Message</h4>
            
            {/* Search Input bar */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search username to send..."
                value={dmSearch}
                onChange={handleDmSearchChange}
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-100 font-bold"
              />
            </div>

            {/* Results scroll container */}
            <div className="max-h-40 overflow-y-auto space-y-1 py-1">
              {searching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                </div>
              )}
              
              {!searching && searchResults.length > 0 && (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition"
                  >
                    <div className="flex items-center space-x-2 min-w-0 mr-1">
                      {user.profile_picture ? (
                        <img
                          src={user.profile_picture}
                          alt={user.username}
                          className="h-7 w-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {user.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 truncate leading-tight">
                          {user.full_name || user.username}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-semibold truncate leading-none mt-0.5">
                          @{user.username}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendDm(user)}
                      disabled={sendingDmTo === user.id}
                      className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition cursor-pointer disabled:opacity-50"
                    >
                      {sendingDmTo === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))
              )}

              {!searching && dmSearch && searchResults.length === 0 && (
                <p className="text-[10px] text-zinc-400 font-semibold text-center py-4">No matching accounts found.</p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
