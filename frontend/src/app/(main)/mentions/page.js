'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { AtSign, FileText, MessageSquare, ChevronRight } from 'lucide-react';
import api from '@/services/api';
import PostCard from '@/components/posts/PostCard';
import { parseContent } from '@/utils/parseContent';

// Helper to format relative time
const getRelativeTime = (dateString) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
};

export default function MentionsPage() {
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'comments'

  // Fetch mentions from backend endpoint
  const { data: mentionsData, error, isLoading } = useSWR('/posts/mentions/', () =>
    api.get('/posts/mentions/').then((res) => res.data)
  );

  const posts = mentionsData?.posts || [];
  const comments = mentionsData?.comments || [];

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col text-left">
      
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-2xl">
            <AtSign className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              Mentions
            </h1>
            <p className="text-[10px] text-zinc-400 font-semibold mt-0.5 leading-none">
              Posts and comments that tag your @username
            </p>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="max-w-3xl w-full mx-auto p-4 md:p-6 flex-1 flex flex-col space-y-6">
        
        {/* TABS ROW */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 font-bold text-xs transition cursor-pointer ${
              activeTab === 'posts'
                ? 'border-primary text-primary'
                : 'border-transparent text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Posts ({posts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 font-bold text-xs transition cursor-pointer ${
              activeTab === 'comments'
                ? 'border-primary text-primary'
                : 'border-transparent text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Comments ({comments.length})</span>
          </button>
        </div>

        {/* FEED AREA */}
        <div className="flex-1 space-y-4 pb-12">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-8 w-8 rounded-full border-4 border-zinc-200 border-t-primary animate-spin" />
              <span className="text-xs text-zinc-400 font-semibold">Loading your mentions...</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="p-4 bg-red-500/5 text-red-500 rounded-2xl text-xs font-semibold text-center border border-red-500/10">
              Failed to load mentions. Please try again.
            </div>
          )}

          {!isLoading && !error && activeTab === 'posts' && (
            posts.length === 0 ? (
              <div className="text-center py-16 space-y-3 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl p-8">
                <FileText className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto" />
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">No post mentions</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto font-medium">
                  When someone mentions you in a post, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )
          )}

          {!isLoading && !error && activeTab === 'comments' && (
            comments.length === 0 ? (
              <div className="text-center py-16 space-y-3 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl p-8">
                <MessageSquare className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto" />
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">No comment mentions</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto font-medium">
                  When someone mentions you in a comment, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div 
                    key={comment.id} 
                    className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl p-5 shadow-sm space-y-4 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {comment.author.profile_picture ? (
                          <img 
                            src={comment.author.profile_picture} 
                            alt={comment.author.username} 
                            className="h-8 w-8 rounded-full object-cover" 
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-xs shrink-0">
                            {comment.author.username?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <Link href={`/${comment.author.username}`} className="font-extrabold text-xs hover:underline text-zinc-900 dark:text-zinc-50">
                            {comment.author.username}
                          </Link>
                          <p className="text-[10px] text-zinc-400 font-semibold leading-none mt-0.5">
                            {getRelativeTime(comment.created_at)}
                          </p>
                        </div>
                      </div>
                      <Link 
                        href={`/posts/${comment.post}`}
                        className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full font-bold transition cursor-pointer flex items-center space-x-0.5"
                      >
                        <span>View Post</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="text-zinc-850 dark:text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap pl-1 font-medium">
                      {parseContent(comment.content)}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

        </div>
      </div>
    </div>
  );
}
