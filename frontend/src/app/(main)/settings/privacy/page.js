'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
  Lock, Eye, MessageSquare, Shield, Ban, Search, Check, AlertCircle, Trash2 
} from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function PrivacySettingsPage() {
  const { user, updateUser, checkAuth } = useAuthStore();
  const [toast, setToast] = useState(null);
  
  // Toggles states
  const [isPrivate, setIsPrivate] = useState(false);
  const [showPresence, setShowPresence] = useState(true);
  const [allowReplies, setAllowReplies] = useState('everyone'); // 'everyone' | 'following' | 'no_one'

  // Block management states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Fetch block list from backend
  const { data: blockListData, mutate: mutateBlockList } = useSWR('/users/blocks/', fetcher);
  const blockedUsers = blockListData?.results || [];

  useEffect(() => {
    if (user) {
      setIsPrivate(!!user.is_private);
    }
  }, [user]);

  // Load local options
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const presence = localStorage.getItem('setting_show_presence');
      if (presence !== null) setShowPresence(presence === 'true');

      const replies = localStorage.getItem('setting_allow_replies');
      if (replies !== null) setAllowReplies(replies);
    }
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSavePrivacySettings = async () => {
    setSavingPrivacy(true);
    try {
      // 1. Submit is_private change to profile endpoint
      const res = await api.patch('/users/profile/', { is_private: isPrivate });
      updateUser(res.data);
      await checkAuth();

      // 2. Save local preferences
      localStorage.setItem('setting_show_presence', showPresence ? 'true' : 'false');
      localStorage.setItem('setting_allow_replies', allowReplies);

      showToast('Privacy preferences updated!', 'success');
    } catch (err) {
      showToast('Failed to save privacy settings', 'error');
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Search profiles to block
  const handleSearchUsers = async (val) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await api.get(`/users/search/?q=${encodeURIComponent(val)}`);
      // Exclude self and already blocked
      const filtered = (res.data.results || []).filter(
        (u) => u.id !== user?.id && !blockedUsers.some((b) => b.blocked.id === u.id)
      );
      setSearchResults(filtered.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  // Block user handler
  const handleBlockUser = async (targetUserId) => {
    try {
      await api.post(`/users/block/${targetUserId}/`);
      mutateBlockList();
      setSearchQuery('');
      setSearchResults([]);
      showToast('User has been blocked', 'success');
    } catch (err) {
      showToast('Could not block user', 'error');
    }
  };

  // Unblock user handler
  const handleUnblockUser = async (targetUserId) => {
    try {
      await api.post(`/users/unblock/${targetUserId}/`);
      mutateBlockList();
      showToast('User unblocked successfully', 'success');
    } catch (err) {
      showToast('Could not unblock user', 'error');
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
          <Lock className="h-5.5 w-5.5 text-primary" />
          <span>Privacy & Safety</span>
        </h1>
        <p className="text-[11px] text-zinc-400 font-semibold mt-0.5 leading-none">Control who can view your posts and details</p>
      </div>

      {toast && (
        <div className={`p-4 rounded-2xl flex items-center space-x-2 text-xs font-bold leading-normal ${
          toast.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400' 
            : 'bg-red-50 dark:bg-red-950/20 border border-red-250 dark:border-red-900 text-red-800 dark:text-red-400'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Privacy preferences block */}
      <div className="space-y-4">
        
        {/* Private Account toggle */}
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl">
          <div className="flex flex-col space-y-1 text-left min-w-0 mr-4">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">Private Account</span>
            <span className="text-[10px] text-zinc-400 font-semibold leading-relaxed">
              Only people you approve can see your posts and stories. Existing followers won't be affected.
            </span>
          </div>
          <button
            onClick={() => setIsPrivate(!isPrivate)}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer focus:outline-none ${
              isPrivate ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* Activity Status presence toggle */}
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl">
          <div className="flex flex-col space-y-1 text-left min-w-0 mr-4">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">Show Activity Status</span>
            <span className="text-[10px] text-zinc-400 font-semibold leading-relaxed">
              Allow accounts you follow to see when you were last active or if you are online.
            </span>
          </div>
          <button
            onClick={() => setShowPresence(!showPresence)}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer focus:outline-none ${
              showPresence ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${showPresence ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* Comment controls select dropdown */}
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl">
          <div className="flex flex-col space-y-1 text-left min-w-0 mr-4">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">Who Can Comment</span>
            <span className="text-[10px] text-zinc-400 font-semibold leading-relaxed">
              Choose who can leave comments on your posts.
            </span>
          </div>
          <select
            value={allowReplies}
            onChange={(e) => setAllowReplies(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-extrabold text-zinc-800 dark:text-zinc-200"
          >
            <option value="everyone">Everyone</option>
            <option value="following">People I Follow</option>
            <option value="no_one">No One</option>
          </select>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSavePrivacySettings}
            disabled={savingPrivacy}
            className="px-5 py-3 rounded-2xl text-xs font-black text-white bg-primary hover:bg-primary-hover shadow-md transition flex items-center space-x-1.5 cursor-pointer"
          >
            {savingPrivacy ? (
              <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
            ) : (
              <span>Save Privacy Preferences</span>
            )}
          </button>
        </div>

      </div>

      {/* 2. Block List manager */}
      <div className="pt-6 border-t border-zinc-150 dark:border-zinc-850 space-y-4">
        <div>
          <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-250 uppercase tracking-wider flex items-center space-x-1.5">
            <Ban className="h-4 w-4 text-red-500" />
            <span>Block List Manager</span>
          </h3>
          <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Blocked users cannot search your profile or see your posts.</p>
        </div>

        {/* Live Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search username to block..."
            value={searchQuery}
            onChange={(e) => handleSearchUsers(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-xs"
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2.5xl p-2.5 space-y-1.5 shadow-md">
            <span className="text-[9px] font-black uppercase text-zinc-400 px-2 tracking-wider">Search Results</span>
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <img
                    src={u.profile_picture || '/default-avatar.png'}
                    alt={u.username}
                    className="h-8 w-8 rounded-full object-cover shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">@{u.username}</span>
                    <span className="text-[9px] text-zinc-400 font-semibold">{u.full_name}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleBlockUser(u.id)}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black rounded-lg transition cursor-pointer"
                >
                  Block
                </button>
              </div>
            ))}
          </div>
        )}

        {/* List of blocked accounts */}
        <div className="space-y-2">
          {blockedUsers.length === 0 ? (
            <div className="text-center py-6 text-[10px] text-zinc-400 font-bold border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2.5xl">
              You haven't blocked any accounts yet
            </div>
          ) : (
            blockedUsers.map((b) => {
              const u = b.blocked;
              if (!u) return null;

              return (
                <div key={b.id} className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/80 rounded-2.5xl shadow-sm">
                  <div className="flex items-center space-x-3.5 min-w-0 mr-4">
                    <img
                      src={u.profile_picture || '/default-avatar.png'}
                      alt={u.username}
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                        @{u.username}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-semibold truncate leading-none mt-0.5">
                        {u.full_name}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblockUser(u.id)}
                    className="px-3 py-1.5 border border-zinc-250 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-[10px] font-black text-zinc-700 dark:text-zinc-350 transition cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
