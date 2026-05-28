import React from 'react';
import { ATLAS_FONT, N } from './tokens';

interface CardProps {
  children: React.ReactNode;
  pad?: number;
  style?: React.CSSProperties;
  accent?: boolean;
}

export function Card({ children, pad = 18, style = {}, accent = false }: CardProps) {
  return (
    <div style={{
      background: N.card,
      border: `1px solid ${N.line}`,
      borderRadius: 12,
      padding: pad,
      fontFamily: ATLAS_FONT,
      boxShadow: '0 1px 0 rgba(15,15,15,0.02)',
      ...(accent ? { borderColor: 'transparent', boxShadow: `0 0 0 1px ${N.line}` } : {}),
      ...style,
    }}>{children}</div>
  );
}
