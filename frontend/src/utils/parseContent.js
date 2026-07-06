import Link from 'next/link';

export const parseContent = (text) => {
  if (!text) return '';
  const parts = text.split(/([#@][a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      return (
        <Link 
          key={index} 
          href={`/search?q=${encodeURIComponent(part)}`}
          className="text-primary hover:underline font-bold"
        >
          {part}
        </Link>
      );
    } else if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <Link 
          key={index} 
          href={`/${username}`}
          className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
        >
          {part}
        </Link>
      );
    }
    return part;
  });
};
