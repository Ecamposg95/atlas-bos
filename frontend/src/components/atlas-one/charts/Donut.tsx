import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from '../tokens';

interface DonutProps {
  value?: number;
  label?: string;
  size?: number;
  color?: string;
  track?: string;
}

export function Donut({ value = 0.72, label, size = 110, color = '#0B0B0B', track = '#EEEAE0' }: DonutProps) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const dash = v * c;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={7} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 22,
          fontWeight: 600,
          fontFamily: ATLAS_FONT,
          color: N.ink,
          fontFeatureSettings: '"tnum"',
        }}>
          {Math.round(v * 100)}
          <span style={{ fontSize: 11, color: N.muted, fontFamily: ATLAS_MONO }}>%</span>
        </div>
        {label && <div style={{
          fontSize: 10,
          color: N.muted,
          fontFamily: ATLAS_MONO,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>{label}</div>}
      </div>
    </div>
  );
}
