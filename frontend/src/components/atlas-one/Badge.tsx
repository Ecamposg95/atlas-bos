import React from 'react';
import { ATLAS_MONO, N } from './tokens';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  soft?: string;
  dot?: boolean;
}

export function Badge({ children, color, soft, dot = false }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontFamily: ATLAS_MONO,
      fontWeight: 500,
      letterSpacing: 0.2,
      background: soft || 'rgba(0,0,0,0.04)',
      color: color || N.body,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: color || N.body }} />}
      {children}
    </span>
  );
}
