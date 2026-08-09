import React from 'react';

interface AtlasMarkProps {
  size?: number;
  color?: string;
  accent?: string | null;
}

export function AtlasMark({ size = 22, color = 'currentColor', accent = null }: AtlasMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke={color} strokeWidth="1.6"/>
      <rect x="8" y="8" width="11.5" height="11.5" rx="2" fill={accent || color}/>
    </svg>
  );
}
