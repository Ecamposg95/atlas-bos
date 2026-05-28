import React from 'react';
import { ATLAS_MONO, N } from '../tokens';

interface BarDatum {
  label: string;
  value: number;
  highlight?: boolean;
}

interface BarChartProps {
  data: BarDatum[];
  width?: number;
  height?: number;
  color?: string;
  soft?: string;
}

export function BarChart({ data, width = 480, height = 180, color = '#0B0B0B', soft = '#E8E5DD' }: BarChartProps) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value));
  const barW = (width - 20) / data.length - 8;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 36);
        const x = 10 + i * (barW + 8);
        const y = height - 22 - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={3} fill={d.highlight ? color : soft} />
            <text
              x={x + barW / 2}
              y={height - 6}
              fontSize={10}
              fontFamily={ATLAS_MONO}
              fill={N.muted}
              textAnchor="middle"
            >{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
