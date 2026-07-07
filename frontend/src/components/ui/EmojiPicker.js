'use client';

const QUICK_EMOJIS = ['😃', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤔', '👍', '👎', '🔥', '👏', '🎉', '❤️', '💔'];

export default function EmojiPicker({ onSelect, layout = 'grid', className = '' }) {
  const layoutClass = layout === 'grid' 
    ? 'grid grid-cols-8 gap-2 p-3 rounded-2xl' 
    : 'flex items-center space-x-2 px-3 py-2 rounded-full';

  return (
    <div className={`${layoutClass} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-45 ${className}`}>
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect && onSelect(emoji)}
          className={`hover:scale-125 transition duration-100 cursor-pointer flex items-center justify-center ${
            layout === 'grid' 
              ? 'h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-lg' 
              : 'text-sm'
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
