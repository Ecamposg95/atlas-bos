import React from 'react';
import { ATLAS_MONO, N } from '../tokens';

interface LineSeries {
  values: number[];
}

interface LineChartProps {
  series: LineSeries[];
  width?: number;
  height?: number;
  color?: string;
  color2?: string;
  labels?: string[];
}

export function LineChart({
  series,
  width = 520,
  height = 200,
  color = '#0B0B0B',
  color2 = '#9C9B95',
  labels = [],
}: LineChartProps) {
  if (!series.length || !series[0].values.length) return null;
  const all = series.flatMap(s => s.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = (max - min) || 1;
  const px = (i: number, n: number) => 30 + (i / (n - 1)) * (width - 50);
  const py = (v: number) => (height - 30) - ((v - min) / span) * (height - 50);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line
          key={i}
          x1={30}
          x2={width - 10}
          y1={height - 30 - t * (height - 50)}
          y2={height - 30 - t * (height - 50)}
          stroke={N.line}
          strokeDasharray="2 3"
        />
      ))}
      {series.map((s, si) => {
        const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i, s.values.length)},${py(v)}`).join(' ');
        const dFill = `${d} L${px(s.values.length - 1, s.values.length)},${height - 30} L${px(0, s.values.length)},${height - 30} Z`;
        const c = si === 0 ? color : color2;
        return (
          <g key={si}>
            {si === 0 && <path d={dFill} fill={c} opacity={0.08} />}
            <path d={d} stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text
          key={i}
          x={px(i, labels.length)}
          y={height - 10}
          fontSize={10}
          fontFamily={ATLAS_MONO}
          fill={N.muted}
          textAnchor="middle"
        >{l}</text>
      ))}
    </svg>
  );
}
