'use client';

import Image from 'next/image';
import { useMemo } from 'react';

// Fallback solid light gray base64 image data url for loading states
const FALLBACK_BLUR_URL = 
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox%3D'0 0 10 10'%3E%3Crect width%3D'100%25' height%3D'100%25' fill%3D'%23e4e4e7'%2F%3E%3C%2Fsvg%3E";

/**
 * Parses Cloudinary URLs to append dynamic width, height, quality, and format optimization parameters.
 */
export function getOptimizedMediaUrl(src, width, height) {
  if (!src || typeof src !== 'string' || !src.includes('res.cloudinary.com')) {
    return src;
  }

  const uploadSegment = '/upload/';
  const uploadIndex = src.indexOf(uploadSegment);
  
  if (uploadIndex !== -1) {
    const beforeUpload = src.substring(0, uploadIndex + uploadSegment.length);
    const afterUpload = src.substring(uploadIndex + uploadSegment.length);

    // Apply auto format (AVIF/WebP) and auto quality compression
    const transforms = ['f_auto', 'q_auto:eco'];
    
    if (width) {
      transforms.push(`w_${width}`);
    }
    if (height) {
      transforms.push(`h_${height}`);
    }

    // Combine transformations
    return `${beforeUpload}${transforms.join(',')}/${afterUpload}`;
  }

  return src;
}

export default function OptimizedImage({
  src,
  alt = 'Media attachment',
  width,
  height,
  fill = false,
  priority = false,
  className = '',
  sizes,
  blurHash,
  ...props
}) {
  // If the image is loaded locally (under /media/ fallback paths)
  const isLocalMedia = src && (src.startsWith('/media/') || src.startsWith('http://127.0.0.1:8000/media/'));

  // Parse and optimize the source URL
  const optimizedSrc = useMemo(() => {
    // If it's a local media path, keep it relative so next.js rewrites it correctly
    if (isLocalMedia && src.startsWith('http://127.0.0.1:8000')) {
      return src.substring(21); // Remove hostname to hit Next.js rewrites config
    }
    return getOptimizedMediaUrl(src, width, height);
  }, [src, width, height, isLocalMedia]);

  // Determine placeholder settings
  const hasBlur = !!blurHash;
  const blurPlaceholder = hasBlur ? blurHash : FALLBACK_BLUR_URL;

  if (!optimizedSrc) {
    return <div className={`bg-zinc-100 dark:bg-zinc-800 ${className}`} style={{ width: fill ? '100%' : width, height: fill ? '100%' : height }} />;
  }

  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      priority={priority}
      sizes={sizes || (fill ? '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' : undefined)}
      placeholder="blur"
      blurDataURL={blurPlaceholder}
      loading={priority ? undefined : 'lazy'}
      className={`${className} transition-opacity duration-300`}
      {...props}
    />
  );
}
