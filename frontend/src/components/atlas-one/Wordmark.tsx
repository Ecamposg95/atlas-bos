import React from 'react';
import { AtlasMark } from './AtlasMark';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';

interface WordmarkProps {
  color?: string;
  accent?: string | null;
  size?: number;
  sub?: string | null;
  mono?: boolean;
}

export function Wordmark({ color = N.ink, accent = null, size = 16, sub = null, mono = false }: WordmarkProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <AtlasMark size={size * 1.3} color={color} accent={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{
          fontFamily: mono ? ATLAS_MONO : ATLAS_FONT,
          fontSize: size,
          fontWeight: 600,
          color,
          letterSpacing: -0.2,
        }}>Atlas One</span>
        {sub && (
          <span style={{
            fontFamily: ATLAS_MONO,
            fontSize: size * 0.65,
            color: accent || color,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginTop: 3,
            opacity: 0.85,
          }}>{sub}</span>
        )}
      </div>
    </div>
  );
}
