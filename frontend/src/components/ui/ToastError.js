'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ToastError({ message, duration = 4000, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 left-6 md:left-auto z-[9999] max-w-sm flex items-start justify-between space-x-3 p-4 rounded-2xl shadow-2xl border border-red-100 dark:border-red-900/40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-all duration-300 animate-slide-up"
      style={{
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      <div className="flex items-start space-x-3 min-w-0">
        <div className="shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-150 leading-relaxed break-words">
          {message || 'An error occurred.'}
        </p>
      </div>
      <button
        onClick={() => {
          setVisible(false);
          if (onClose) onClose();
        }}
        className="shrink-0 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 transition-colors p-0.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>

      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
