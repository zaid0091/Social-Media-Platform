'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import OptimizedImage from '../ui/OptimizedImage';

export default function CarouselComponent({ media = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStart = useRef(0);
  const touchEnd = useRef(0);

  if (media.length === 0) return null;

  const nextSlide = (e) => {
    e.stopPropagation();
    if (currentIndex < media.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const prevSlide = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleTouchStart = (e) => {
    touchStart.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const diff = touchStart.current - touchEnd.current;

    // Minimum swipe distance threshold of 50px
    if (diff > 50) {
      // Swiped Left -> Next slide
      if (currentIndex < media.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    }
    if (diff < -50) {
      // Swiped Right -> Previous slide
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
    }
    
    // Reset values
    touchStart.current = 0;
    touchEnd.current = 0;
  };

  return (
    <div 
      className="relative w-full aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides Translate view wrapper */}
      <div 
        className="flex w-full h-full transition-transform duration-350 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {media.map((item, index) => (
          <div 
            key={item.id || index}
            className="w-full h-full shrink-0 flex items-center justify-center bg-zinc-950 relative"
          >
            <OptimizedImage 
              src={item.media_url} 
              alt={`Slide ${index + 1}`}
              fill
              priority={index === currentIndex}
              blurHash={item.blur_hash}
              className="object-contain"
              draggable="false"
            />
          </div>
        ))}
      </div>

      {/* Slide Navigation Overlay Buttons */}
      {currentIndex > 0 && (
        <button
          onClick={prevSlide}
          className="absolute left-3 p-1.5 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer select-none z-10"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {currentIndex < media.length - 1 && (
        <button
          onClick={nextSlide}
          className="absolute right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer select-none z-10"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Dot Indicators */}
      {media.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-1.5 z-10">
          {media.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                index === currentIndex 
                  ? 'w-4 bg-primary' 
                  : 'w-1.5 bg-white/50 hover:bg-white/85'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
