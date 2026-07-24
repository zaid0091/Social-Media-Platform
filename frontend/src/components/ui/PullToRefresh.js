'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function PullToRefresh({ children, onRefresh }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      // Allow drag refresh only if we are at the top of the container scroll
      if (container.scrollTop === 0) {
        startYRef.current = e.touches[0].clientY;
      } else {
        startYRef.current = 0;
      }
    };

    const handleTouchMove = (e) => {
      if (startYRef.current === 0) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0) {
        // Dragging down: apply dynamic resistance factor
        const distance = Math.min(diff * 0.45, 80);
        setPullDistance(distance);
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (startYRef.current === 0) return;
      startYRef.current = 0;

      if (pullDistance > 55) {
        setIsRefreshing(true);
        setPullDistance(50); // Set fixed distance during reload spinner show
        try {
          if (onRefresh) {
            await onRefresh();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, onRefresh]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto relative scroll-smooth">
      {/* PTR Visual Banner indicator */}
      <div 
        className="flex items-center justify-center bg-zinc-50/90 dark:bg-zinc-950/90 border-b border-zinc-200/50 dark:border-zinc-800/30 overflow-hidden transition-all duration-75 select-none"
        style={{ height: `${pullDistance}px`, opacity: pullDistance > 0 ? 1 : 0 }}
      >
        <div className="flex items-center space-x-2 text-primary font-bold text-xs">
          <Loader2 className={`h-4.5 w-4.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-zinc-450'}`} style={{ transform: isRefreshing ? 'none' : `rotate(${pullDistance * 4.5}deg)` }} />
          <span>{isRefreshing ? 'Refreshing...' : pullDistance > 55 ? 'Release to refresh' : 'Pull to refresh'}</span>
        </div>
      </div>
      
      <div 
        className="w-full h-full min-h-0"
        style={{ 
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none', 
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : 'none' 
        }}
      >
        {children}
      </div>
    </div>
  );
}
