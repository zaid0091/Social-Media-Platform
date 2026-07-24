'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import useModalAccessibility from '@/hooks/useModalAccessibility';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
  isLoading = false
}) {
  const modalRef = useModalAccessibility(isOpen, onCancel);
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />
      
      {/* Dialog container */}
      <div 
        ref={modalRef}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-xl relative z-10 text-left animate-in fade-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-label={title || "Confirm Action"}
      >
        <div className="flex items-start space-x-3.5">
          {isDangerous && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/30 rounded-2xl text-red-500 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          
          <div className="space-y-1.5 min-w-0 flex-1">
            <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50 leading-tight">
              {title}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-450 font-semibold leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex space-x-2 mt-6">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-xs font-black text-zinc-700 dark:text-zinc-300 rounded-xl transition cursor-pointer select-none disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-xs font-black text-white rounded-xl transition cursor-pointer select-none disabled:opacity-50 flex items-center justify-center ${
              isDangerous 
                ? 'bg-red-500 hover:bg-red-600 shadow-sm' 
                : 'bg-primary hover:bg-primary-hover shadow-sm'
            }`}
          >
            {isLoading ? (
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
