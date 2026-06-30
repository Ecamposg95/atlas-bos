import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';

interface SectionTitleProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionTitle({ children, action }: SectionTitleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>{children}</div>
      {action && <div style={{ fontSize: 12, color: N.muted, fontFamily: ATLAS_FONT, cursor: 'pointer' }}>{action}</div>}
    </div>
  );
}
