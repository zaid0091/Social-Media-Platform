'use client';

import { useState, useEffect } from 'react';
import { Paintbrush, Sun, Moon, Monitor, Check, Save } from 'lucide-react';

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState('system'); // 'light' | 'dark' | 'system'
  const [fontSize, setFontSize] = useState('14px'); // '12px' | '14px' | '16px' | '18px'
  const [toast, setToast] = useState(false);

  // Load preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) setTheme(savedTheme);

      const savedSize = localStorage.getItem('font-size');
      if (savedSize) setFontSize(savedSize);
    }
  }, []);

  const applyTheme = (targetTheme) => {
    if (typeof window === 'undefined') return;

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (targetTheme === 'dark') {
      root.classList.add('dark');
    } else if (targetTheme === 'light') {
      root.classList.add('light');
    } else {
      // System
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) root.classList.add('dark');
      else root.classList.add('light');
    }
  };

  const applyFontSize = (size) => {
    if (typeof window === 'undefined') return;
    const sizeMap = {
      '12px': '13px',
      '14px': '14px',
      '16px': '15px',
      '18px': '16px'
    };
    window.document.documentElement.style.fontSize = sizeMap[size] || '14px';
  };

  const handleSaveAppearance = () => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('font-size', fontSize);

    applyTheme(theme);
    applyFontSize(fontSize);

    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
          <Paintbrush className="h-5.5 w-5.5 text-primary" />
          <span>Appearance</span>
        </h1>
        <p className="text-[11px] text-zinc-400 font-semibold mt-0.5 leading-none">Customize how the platform looks on your screen</p>
      </div>

      {toast && (
        <div className="p-4 rounded-2xl flex items-center space-x-2 text-xs font-bold leading-normal bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>Appearance preferences saved and applied!</span>
        </div>
      )}

      {/* 1. Theme Selection Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-zinc-850 dark:text-zinc-250 uppercase tracking-wider">Interface Theme</h3>
        
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light Mode', icon: Sun },
            { id: 'dark', label: 'Dark Mode', icon: Moon },
            { id: 'system', label: 'System Default', icon: Monitor }
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = theme === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setTheme(mode.id)}
                className={`p-4 rounded-2.5xl border transition flex flex-col items-center justify-center space-y-2 cursor-pointer text-center select-none ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/10'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-black">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Font Size Selection */}
      <div className="space-y-3 pt-4 border-t border-zinc-150 dark:border-zinc-850">
        <h3 className="text-xs font-black text-zinc-850 dark:text-zinc-250 uppercase tracking-wider">Font Size Scale</h3>
        <p className="text-[10px] text-zinc-400 font-semibold leading-none mt-0.5">Scale down or enlarge body text styles.</p>

        <div className="flex space-x-2">
          {['12px', '14px', '16px', '18px'].map((size) => {
            const labelMap = { '12px': 'Small', '14px': 'Default', '16px': 'Medium', '18px': 'Large' };
            const isSelected = fontSize === size;
            return (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`flex-1 py-3 px-2 border rounded-xl text-center cursor-pointer select-none text-xs font-bold transition ${
                  isSelected
                    ? 'bg-primary border-primary text-white font-extrabold shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                }`}
              >
                {labelMap[size]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-2 border-t border-zinc-155 dark:border-zinc-850">
        <button
          onClick={handleSaveAppearance}
          className="px-5 py-3 rounded-2xl text-xs font-black text-white bg-primary hover:bg-primary-hover shadow-md transition flex items-center space-x-1.5 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>Save Preferences</span>
        </button>
      </div>

    </div>
  );
}
