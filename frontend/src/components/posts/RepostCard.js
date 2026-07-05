'use client';

import Link from 'next/link';
import { Film } from 'lucide-react';

export default function RepostCard({ post }) {
  if (!post) return null;

  const parseContent = (text) => {
    if (!text) return '';
    const parts = text.split(/([#@][a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-primary font-bold">
            {part}
          </span>
        );
      } else if (part.startsWith('@')) {
        return (
          <span key={index} className="text-primary font-bold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const hasVideo = post.media?.some((m) => m.media_type === 'video');
  const hasImage = post.media?.length > 0 && !hasVideo;

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20 p-3.5 space-y-2 mt-2 select-none hover:bg-zinc-100/30 dark:hover:bg-zinc-900/30 transition text-left">
      
      {/* Author Header */}
      <div className="flex items-center space-x-2">
        {post.author?.profile_picture ? (
          <img
            src={post.author.profile_picture}
            alt={post.author.username}
            className="h-5 w-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-[8px] shrink-0">
            {post.author?.username?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex items-center space-x-1 min-w-0">
          <span className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 truncate leading-none">
            {post.author?.full_name || post.author?.username}
          </span>
          <span className="text-[9px] text-zinc-400 font-semibold truncate leading-none">
            @{post.author?.username}
          </span>
        </div>
      </div>

      {/* Content text */}
      {post.content && (
        <p className="text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-300 break-words whitespace-pre-wrap">
          {parseContent(post.content)}
        </p>
      )}

      {/* Attachment Thumbnail Previews */}
      {post.media && post.media.length > 0 && (
        <div className="relative max-h-48 rounded-xl overflow-hidden bg-zinc-900/5 flex items-center justify-center border border-zinc-150 dark:border-zinc-850 aspect-video">
          {hasImage && (
            <img
              src={post.media[0].media_url}
              alt="Nested Attachment"
              className="w-full h-full object-cover"
            />
          )}
          {hasVideo && (
            <>
              <img
                src={post.media[0].thumbnail_url || post.media[0].media_url}
                alt="Nested Video Attachment"
                className="w-full h-full object-cover filter brightness-90"
              />
              <Film className="absolute top-2.5 right-2.5 h-4 w-4 text-white drop-shadow" />
            </>
          )}
        </div>
      )}

    </div>
  );
}
