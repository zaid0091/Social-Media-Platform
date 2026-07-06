'use client';

import React from 'react';

export default function Sparkline({ data = [], width = 70, height = 22 }) {
  if (!data || data.length === 0) return null;

  // Clean data to only include numeric values
  const cleanData = data.map(val => Number(val) || 0);

  const max = Math.max(...cleanData, 1);
  const min = Math.min(...cleanData);
  const range = max - min || 1;

  // Map each data value to coordinates inside SVG box
  const points = cleanData.map((val, idx) => {
    const x = (idx / (cleanData.length - 1)) * width;
    // Invert y because SVG y goes down
    const y = height - ((val - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="shrink-0 flex items-center select-none" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Shadow glow under line */}
        <polyline
          fill="none"
          stroke="url(#sparklineGlow)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          opacity="0.1"
        />
        {/* Main Line */}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="text-primary-600 dark:text-primary-400"
        />
        {/* Color Gradient definitions */}
        <defs>
          <linearGradient id="sparklineGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary, #7c3aed)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
