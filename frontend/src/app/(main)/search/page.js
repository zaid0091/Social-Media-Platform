'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Clock, User as UserIcon, Hash, Heart, MessageCircle, UserPlus, UserCheck } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuthStore();

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [activeTab, setActiveTab] = useState('top'); // 'top' | 'people' | 'posts' | 'hashtags'
  
  // Persistence search history
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Results states
  const [peopleResults, setPeopleResults] = useState([]);
  const [postsResults, setPostsResults] = useState([]);
  const [hashtagsResults, setHashtagsResults] = useState([]);
  const [globalResults, setGlobalResults] = useState({ users: [], hashtags: [] });
  
  // Suggestions states
  const [suggestions, setSuggestions] = useState({ users: [], hashtags: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestedTrends, setSuggestedTrends] = useState({ suggested_users: [], suggested_hashtags: [] });

  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Focus input on mount and load search history
  useEffect(() => {
    inputRef.current?.focus();
    
    // Load local search history
    const history = JSON.parse(localStorage.getItem('recent_searches') || '[]');
    setRecentSearches(history);

    // Fetch initial trend suggestions from the backend
    api.get('/search/suggested/')
      .then((res) => {
        setSuggestedTrends(res.data);
      })
      .catch((err) => console.error('Failed to load suggested trends', err));

    // Read initial search query if passed from search params
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setQuery(initialQuery);
      handleTriggerSearch(initialQuery);
    }
  }, [searchParams]);

  // Sync click outside to close suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions as the user types (debounced slightly or on change)
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions({ users: [], hashtags: [] });
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const response = await api.get(`/search/global/?q=${encodeURIComponent(query)}`);
        setSuggestions(response.data);
      } catch (err) {
        console.error('Failed to load suggestions', err);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Trigger search execution
  const handleTriggerSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setSubmittedQuery(searchQuery);
    setShowSuggestions(false);
    setLoading(true);

    // Update history locally in localStorage
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item !== searchQuery);
      const updated = [searchQuery, ...filtered].slice(0, 15);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
      return updated;
    });

    try {
      // Fetch results for all tabs in parallel to populate state
      const [usersRes, postsRes, hashtagsRes, globalRes] = await Promise.all([
        api.get(`/search/users/?q=${encodeURIComponent(searchQuery)}`),
        api.get(`/search/posts/?q=${encodeURIComponent(searchQuery)}`),
        api.get(`/search/hashtags/?q=${encodeURIComponent(searchQuery)}`),
        api.get(`/search/global/?q=${encodeURIComponent(searchQuery)}`)
      ]);

      setPeopleResults(usersRes.data.results || []);
      setPostsResults(postsRes.data.results || []);
      setHashtagsResults(hashtagsRes.data.results || []);
      setGlobalResults(globalRes.data);

    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoading(false);
    }
  };

  // Follow/Unfollow toggle handler inside search list
  const handleFollowToggle = async (userId, username, isFollowing) => {
    try {
      if (isFollowing) {
        await api.post(`/users/${username}/unfollow/`);
      } else {
        await api.post(`/users/${username}/follow/`);
      }
      
      // Update local states dynamically
      const updateList = (list) => 
        list.map((u) => u.id === userId ? { 
          ...u, 
          is_following: !isFollowing,
          follower_count: isFollowing ? u.follower_count - 1 : u.follower_count + 1 
        } : u);

      setPeopleResults((prev) => updateList(prev));
      setGlobalResults((prev) => ({
        ...prev,
        users: updateList(prev.users)
      }));
    } catch (err) {
      console.error('Failed to toggle follow status', err);
    }
  };

  // Delete single search history item
  const handleDeleteHistoryItem = (e, item) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((q) => q !== item);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all search histories
  const handleClearAllHistory = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches');
    // Call backend endpoint silently to clear redis logs
    api.post('/search/clear/').catch(() => {});
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleTriggerSearch(query);
  };

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-6 md:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER TITLE */}
        <div className="flex flex-col text-left">
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-tight">Search</h1>
          <p className="text-xs text-zinc-400 font-semibold mt-0.5 leading-none">Find people, posts, and trending conversations</p>
        </div>

        {/* SEARCH BAR CONTAINER */}
        <div ref={searchContainerRef} className="relative z-40">
          <form onSubmit={handleFormSubmit} className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2.5xl px-4 py-3 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent">
            <Search className="h-5 w-5 text-zinc-450 mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="bg-transparent text-xs w-full outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSuggestions({ users: [], hashtags: [] });
                  inputRef.current?.focus();
                }}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-650 transition cursor-pointer"
                aria-label="Clear input"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* DYNAMIC SUGGESTIONS / HISTORY DROPDOWN */}
          {showSuggestions && (
            <div className="absolute top-14 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-2.5xl shadow-xl overflow-hidden text-left z-50">
              
              {/* Type 1: Recent searches (When query is empty) */}
              {!query.trim() && (
                <div className="p-4 space-y-3.5">
                  {recentSearches.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-2">
                        <span>Recent Searches</span>
                        <button 
                          type="button"
                          onClick={handleClearAllHistory}
                          className="hover:text-primary transition cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        {recentSearches.map((item) => (
                          <div
                            key={item}
                            onClick={() => {
                              setQuery(item);
                              handleTriggerSearch(item);
                            }}
                            className="flex items-center justify-between py-2.5 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl cursor-pointer group transition"
                          >
                            <div className="flex items-center text-xs text-zinc-700 dark:text-zinc-300 font-bold">
                              <Clock className="h-4 w-4 text-zinc-400 mr-2.5 shrink-0" />
                              <span>{item}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteHistoryItem(e, item)}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-650 transition cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Default Suggested Trends when history is empty
                    <div className="space-y-4">
                      {suggestedTrends.suggested_hashtags?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block mb-2">Trending Hashtags</span>
                          <div className="flex flex-wrap gap-2">
                            {suggestedTrends.suggested_hashtags.map((tag) => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                  const q = `#${tag.name}`;
                                  setQuery(q);
                                  handleTriggerSearch(q);
                                }}
                                className="px-3.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 text-xs font-black text-zinc-650 dark:text-zinc-350 border border-zinc-200/50 dark:border-zinc-800/80 rounded-2-full transition cursor-pointer"
                              >
                                #{tag.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {suggestedTrends.suggested_users?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block mb-2">Suggested Creators</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {suggestedTrends.suggested_users.map((u) => (
                              <div
                                key={u.id}
                                onClick={() => {
                                  router.push(`/${u.username}`);
                                  setShowSuggestions(false);
                                }}
                                className="flex items-center space-x-2.5 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl cursor-pointer transition border border-zinc-100 dark:border-zinc-850"
                              >
                                <img src={u.profile_picture || '/default-avatar.png'} alt={u.username} className="h-8 w-8 rounded-full object-cover" />
                                <div className="flex flex-col text-left">
                                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">@{u.username}</span>
                                  <span className="text-[10px] text-zinc-400 font-semibold">{u.follower_count} followers</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Type 2: Search Auto-Suggestions (As user types) */}
              {query.trim() && (
                <div className="p-2 divide-y divide-zinc-100 dark:divide-zinc-850 text-xs">
                  
                  {/* User suggestions */}
                  {suggestions.users?.length > 0 && (
                    <div className="p-2 space-y-1.5">
                      <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Matching Users</span>
                      {suggestions.users.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            router.push(`/${u.username}`);
                            setShowSuggestions(false);
                          }}
                          className="flex items-center space-x-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl cursor-pointer transition"
                        >
                          <img src={u.profile_picture || '/default-avatar.png'} alt={u.username} className="h-8.5 w-8.5 rounded-full object-cover" />
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">@{u.username}</span>
                            <span className="text-[10px] text-zinc-400 font-semibold">{u.full_name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hashtag suggestions */}
                  {suggestions.hashtags?.length > 0 && (
                    <div className="p-2 space-y-1.5">
                      <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Matching Hashtags</span>
                      {suggestions.hashtags.map((tag) => (
                        <div
                          key={tag.id}
                          onClick={() => {
                            const q = `#${tag.name}`;
                            setQuery(q);
                            handleTriggerSearch(q);
                          }}
                          className="flex items-center space-x-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl cursor-pointer transition"
                        >
                          <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center text-zinc-450 shrink-0">
                            <Hash className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">#{tag.name}</span>
                            <span className="text-[10px] text-zinc-400 font-semibold">{tag.post_count} posts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* If no matching suggestions */}
                  {suggestions.users?.length === 0 && suggestions.hashtags?.length === 0 && (
                    <div className="p-4 text-center text-zinc-400 font-semibold text-xs">
                      Press enter to search for <span className="font-extrabold text-zinc-600 dark:text-zinc-200">"{query}"</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {/* SUBMITTED RESULTS SECTION */}
        {submittedQuery && (
          <div className="space-y-6">
            
            {/* TABS HEADER BAR */}
            <div className="flex border-b border-zinc-150 dark:border-zinc-850">
              {['top', 'people', 'posts', 'hashtags'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-xs font-black capitalize border-b-2 transition relative cursor-pointer ${
                    activeTab === tab 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-zinc-450 hover:text-zinc-650 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* loading skeletons */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl p-4 animate-pulse space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-1/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        <div className="h-2.5 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </div>
                    </div>
                    <div className="h-24 bg-zinc-100 dark:bg-zinc-850 rounded-2xl w-full" />
                  </div>
                ))}
              </div>
            ) : (
              
              /* TAB CONTENTS */
              <div className="text-left">
                
                {/* 1. TOP TAB (Combined Results) */}
                {activeTab === 'top' && (
                  <div className="space-y-6">
                    {/* People section */}
                    {globalResults.users?.length > 0 && (
                      <div className="space-y-3">
                        <h2 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">People</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {globalResults.users.map((u) => (
                            <div 
                              key={u.id}
                              className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-2.5xl shadow-sm"
                            >
                              <Link href={`/${u.username}`} className="flex items-center space-x-3.5 min-w-0">
                                <img src={u.profile_picture || '/default-avatar.png'} alt={u.username} className="h-10 w-10 rounded-full object-cover" />
                                <div className="flex flex-col text-left min-w-0">
                                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 leading-tight">@{u.username}</span>
                                  <span className="text-[10px] text-zinc-400 font-semibold leading-none mt-0.5">{u.full_name}</span>
                                </div>
                              </Link>
                              {u.id !== currentUser?.id && (
                                <button
                                  onClick={() => handleFollowToggle(u.id, u.username, u.is_following)}
                                  className={`px-3 py-1.5 text-[10px] font-black rounded-xl transition cursor-pointer flex items-center space-x-1 ${
                                    u.is_following 
                                      ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300' 
                                      : 'bg-primary hover:bg-primary-hover text-white'
                                  }`}
                                >
                                  {u.is_following ? <UserCheck className="h-3 w-3 mr-0.5" /> : <UserPlus className="h-3 w-3 mr-0.5" />}
                                  <span>{u.is_following ? 'Following' : 'Follow'}</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hashtags section */}
                    {globalResults.hashtags?.length > 0 && (
                      <div className="space-y-3">
                        <h2 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Hashtags</h2>
                        <div className="flex flex-wrap gap-2">
                          {globalResults.hashtags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => {
                                const q = `#${tag.name}`;
                                setQuery(q);
                                handleTriggerSearch(q);
                              }}
                              className="px-3.5 py-2 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-xs font-bold text-zinc-750 dark:text-zinc-250 border border-zinc-200 dark:border-zinc-800 rounded-2-full shadow-sm transition cursor-pointer flex items-center space-x-1.5"
                            >
                              <Hash className="h-3.5 w-3.5 text-zinc-400" />
                              <span className="font-extrabold">#{tag.name}</span>
                              <span className="text-[9px] text-zinc-400 font-semibold">{tag.post_count} posts</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent posts grid section */}
                    <div className="space-y-3">
                      <h2 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Posts</h2>
                      {postsResults.length > 0 ? (
                        <div className="grid grid-cols-3 gap-1 md:gap-2">
                          {postsResults.map((post) => (
                            <Link 
                              href={`/posts/${post.id}`} 
                              key={post.id}
                              className="aspect-square relative group overflow-hidden bg-zinc-150 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-850"
                            >
                              {post.media_url ? (
                                <img src={post.media_url} alt="Post Thumbnail" className="w-full h-full object-cover transition duration-300 group-hover:scale-105" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center p-3 text-center text-[10px] text-zinc-500 font-bold bg-zinc-50 dark:bg-zinc-850 break-words line-clamp-4">
                                  {post.content}
                                </div>
                              )}
                              
                              {/* Hover Overlay info */}
                              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center space-x-4 text-white text-xs font-black">
                                <span className="flex items-center"><Heart className="h-4 w-4 mr-1 fill-white" /> {post.like_count || 0}</span>
                                <span className="flex items-center"><MessageCircle className="h-4 w-4 mr-1 fill-white" /> {post.comment_count || 0}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 font-semibold">No posts found matching your search</p>
                      )}
                    </div>

                    {/* Overall Empty layout */}
                    {globalResults.users?.length === 0 && globalResults.hashtags?.length === 0 && postsResults.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-sm font-bold text-zinc-450">No results found for "{submittedQuery}"</p>
                        <p className="text-xs text-zinc-400 mt-1">Double check spellings or try other keywords</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. PEOPLE TAB */}
                {activeTab === 'people' && (
                  <div>
                    {peopleResults.length > 0 ? (
                      <div className="flex flex-col space-y-2">
                        {peopleResults.map((u) => (
                          <div 
                            key={u.id}
                            className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-2.5xl shadow-sm"
                          >
                            <Link href={`/${u.username}`} className="flex items-center space-x-3.5 min-w-0">
                              <img src={u.profile_picture || '/default-avatar.png'} alt={u.username} className="h-10 w-10 rounded-full object-cover" />
                              <div className="flex flex-col text-left min-w-0">
                                <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 leading-tight">@{u.username}</span>
                                <span className="text-[10px] text-zinc-400 font-semibold leading-none mt-0.5">{u.full_name}</span>
                                <span className="text-[9px] text-zinc-450 font-bold mt-1 block">{u.follower_count} followers</span>
                              </div>
                            </Link>
                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleFollowToggle(u.id, u.username, u.is_following)}
                                className={`px-4 py-2 text-[10px] font-black rounded-xl transition cursor-pointer flex items-center space-x-1 ${
                                  u.is_following 
                                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300' 
                                    : 'bg-primary hover:bg-primary-hover text-white'
                                }`}
                              >
                                {u.is_following ? <UserCheck className="h-3.5 w-3.5 mr-0.5" /> : <UserPlus className="h-3.5 w-3.5 mr-0.5" />}
                                <span>{u.is_following ? 'Following' : 'Follow'}</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-xs font-bold text-zinc-400">No users found matching "{submittedQuery}"</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. POSTS TAB */}
                {activeTab === 'posts' && (
                  <div>
                    {postsResults.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1 md:gap-2">
                        {postsResults.map((post) => (
                          <Link 
                            href={`/posts/${post.id}`} 
                            key={post.id}
                            className="aspect-square relative group overflow-hidden bg-zinc-150 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-850"
                          >
                            {post.media_url ? (
                              <img src={post.media_url} alt="Post Thumbnail" className="w-full h-full object-cover transition duration-300 group-hover:scale-105" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center p-3 text-center text-[10px] text-zinc-550 font-bold bg-zinc-50 dark:bg-zinc-850 break-words line-clamp-4">
                                {post.content}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center space-x-4 text-white text-xs font-black">
                              <span className="flex items-center"><Heart className="h-4 w-4 mr-1 fill-white" /> {post.like_count || 0}</span>
                              <span className="flex items-center"><MessageCircle className="h-4 w-4 mr-1 fill-white" /> {post.comment_count || 0}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-xs font-bold text-zinc-400">No posts found matching "{submittedQuery}"</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. HASHTAGS TAB */}
                {activeTab === 'hashtags' && (
                  <div>
                    {hashtagsResults.length > 0 ? (
                      <div className="flex flex-col space-y-1 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-2.5xl p-2.5 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-850">
                        {hashtagsResults.map((tag) => (
                          <div
                            key={tag.id}
                            onClick={() => {
                              const q = `#${tag.name}`;
                              setQuery(q);
                              handleTriggerSearch(q);
                            }}
                            className="flex items-center space-x-3.5 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-2xl cursor-pointer transition first:pt-3 last:pb-3"
                          >
                            <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center text-zinc-450 shrink-0">
                              <Hash className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">#{tag.name}</span>
                              <span className="text-[10px] text-zinc-450 font-semibold">{tag.post_count} posts</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-xs font-bold text-zinc-400">No hashtags found matching "{submittedQuery}"</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
