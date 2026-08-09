import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';

interface TopbarProps {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

export function Topbar({ title, sub, right, children }: TopbarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '18px 28px 16px',
      borderBottom: `1px solid ${N.line}`,
      background: N.card,
      fontFamily: ATLAS_FONT,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 600, color: N.ink, letterSpacing: -0.2 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: N.muted, marginTop: 2, fontFamily: ATLAS_MONO }}>{sub}</div>}
      </div>
      {children}
      {right}
    </div>
  );
}
