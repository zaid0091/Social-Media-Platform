'use client';

import useUI from '@/hooks/useUI';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useUI();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-6 left-6 md:left-auto z-[9999] flex flex-col space-y-3 max-w-sm w-auto">
      {toasts.map((toast) => {
        let icon = <Info className="h-5 w-5 text-blue-500" />;
        let borderColor = 'border-blue-100 dark:border-blue-900/40';
        let bgStyle = 'bg-white/95 dark:bg-zinc-900/95';

        if (toast.type === 'success') {
          icon = <CheckCircle className="h-5 w-5 text-emerald-500" />;
          borderColor = 'border-emerald-100 dark:border-emerald-900/40';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="h-5 w-5 text-rose-500" />;
          borderColor = 'border-rose-100 dark:border-rose-900/40';
        }

        return (
          <div
            key={toast.id}
            className={`flex items-start justify-between space-x-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-slide-up ${bgStyle} ${borderColor}`}
            style={{
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <div className="flex items-start space-x-3 min-w-0">
              <div className="shrink-0 mt-0.5">{icon}</div>
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-150 leading-relaxed break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 transition-colors p-0.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {/* Inject custom CSS keyframes for the slide-up animation */}
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
