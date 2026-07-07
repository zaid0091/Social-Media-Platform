'use client';

import { useState, useEffect, useRef } from 'react';
import OptimizedImage from './OptimizedImage';

export default function LazyViewportImage({ src, alt = 'Media asset', blurHash, className = '', ...props }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { rootMargin: '200px' } // Pre-load slightly before entering viewport
    );

    observer.observe(element);
    return () => {
      if (element) observer.unobserve(element);
    };
  }, []);

  return (
    <div ref={ref} className={`w-full h-full relative ${className}`}>
      {isVisible ? (
        <OptimizedImage
          src={src}
          alt={alt}
          blurHash={blurHash}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          {...props}
        />
      ) : (
        // Skeleton placeholder until it hits viewport boundaries
        <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      )}
    </div>
  );
}
