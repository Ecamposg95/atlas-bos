import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';
import { Card } from './Card';
import { Sparkline } from './charts/Sparkline';
import { Icon } from './icons/iconLib';

interface KpiProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  trend?: number[];
  accent?: string;
  sub?: string;
}

export function Kpi({ label, value, unit, delta, trend = [], accent, sub }: KpiProps) {
  const positive = !!delta && delta.startsWith('+');
  return (
    <Card pad={18} style={{ minHeight: 132, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontSize: 11.5,
        fontFamily: ATLAS_MONO,
        letterSpacing: 0.8,
        color: N.muted,
        textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{
          fontSize: 28,
          fontWeight: 600,
          color: N.ink,
          letterSpacing: -0.8,
          fontFeatureSettings: '"tnum"',
        }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: N.muted, fontFamily: ATLAS_MONO }}>{unit}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        {sub ? (
          <div style={{ fontSize: 11.5, color: N.muted, fontFamily: ATLAS_MONO }}>{sub}</div>
        ) : (
          delta && <div style={{
            fontSize: 12,
            fontFamily: ATLAS_MONO,
            color: positive ? '#0E8A4E' : '#B43E2E',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}>
            {positive ? <Icon.arrowUp size={11} color="currentColor" /> : <Icon.arrowDown size={11} color="currentColor" />}
            {delta}
          </div>
        )}
        {trend.length > 0 && <Sparkline values={trend} color={accent || N.body} width={70} height={22} />}
      </div>
    </Card>
  );
}
