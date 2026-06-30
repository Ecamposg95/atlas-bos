import React from 'react';
import { ATLAS_FONT, N } from './tokens';

interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
}

export function Avatar({ name, size = 28, color = '#E8E5DD' }: AvatarProps) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      color: N.ink,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.36,
      fontWeight: 600,
      fontFamily: ATLAS_FONT,
      flexShrink: 0,
    }}>{initials}</div>
  );
}
