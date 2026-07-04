'use client';

import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';

export default function HomeFeedPage() {
  const mockPosts = [
    {
      id: 1,
      author: 'Sarah Connor',
      handle: 'sarah',
      content: 'Building the future of social technology with Next.js App Router and Tailwind CSS v4! The developer experience is absolutely incredible. 🚀 #webdev #nextjs',
      likes: 124,
      comments: 18,
      shares: 12,
      time: '2h ago'
    },
    {
      id: 2,
      author: 'John Connor',
      handle: 'john',
      content: 'Just deployed the new asynchronous Celery notification worker backend. Processing millions of feed updates in real-time is now faster than ever! ⚡ #django #python',
      likes: 89,
      comments: 7,
      shares: 3,
      time: '4h ago'
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky page header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Home</h1>
      </header>

      {/* Main feed list */}
      <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {mockPosts.map((post) => (
          <article key={post.id} className="p-6 flex flex-col space-y-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-all">
            {/* User Meta header */}
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center font-bold text-white">
                {post.author.charAt(0)}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-sm leading-tight hover:underline cursor-pointer">{post.author}</span>
                  <span className="text-xs text-zinc-500">@{post.handle}</span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs text-zinc-400">{post.time}</span>
                </div>
              </div>
            </div>

            {/* Post Content */}
            <p className="text-zinc-800 dark:text-zinc-200 text-[15px] leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>

            {/* Post Action Buttons bar */}
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 pt-2 max-w-md">
              <button className="flex items-center space-x-2 group hover:text-red-500 transition-colors">
                <Heart className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">{post.likes}</span>
              </button>

              <button className="flex items-center space-x-2 group hover:text-primary transition-colors">
                <MessageCircle className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">{post.comments}</span>
              </button>

              <button className="flex items-center space-x-2 group hover:text-green-500 transition-colors">
                <Share2 className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold">{post.shares}</span>
              </button>

              <button className="flex items-center space-x-2 group hover:text-yellow-500 transition-colors">
                <Bookmark className="h-4.5 w-4.5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
