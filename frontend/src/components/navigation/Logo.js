import Link from 'next/link';

export default function Logo() {
  return (
    <Link 
      href="/" 
      className="inline-flex items-center px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      aria-label="Social Media Platform Home"
    >
      <span className="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent hover:opacity-90 transition-opacity select-none">
        PLATFORM
      </span>
    </Link>
  );
}
