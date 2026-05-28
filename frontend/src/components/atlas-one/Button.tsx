import React from 'react';
import { ATLAS_FONT, N, PresetConfig } from './tokens';
import type { IconComponent } from './icons/iconLib';

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'accent';
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  label: string;
  kind?: ButtonKind;
  preset?: PresetConfig;
  icon?: IconComponent;
  size?: ButtonSize;
  onClick?: () => void;
}

export function Button({ label, kind = 'primary', preset, icon: IconCmp, size = 'md', onClick }: ButtonProps) {
  const accent = preset?.accent || N.ink;
  const styles: Record<ButtonKind, React.CSSProperties> = {
    primary:   { background: accent, color: '#fff', border: 'none' },
    secondary: { background: N.card, color: N.ink, border: `1px solid ${N.line2}` },
    ghost:     { background: 'transparent', color: N.ink, border: 'none' },
    accent:    { background: preset?.accentSoft || N.chip, color: preset?.accentInk || N.ink, border: 'none' },
  };
  const sizing: React.CSSProperties = size === 'sm'
    ? { padding: '5px 10px', fontSize: 12 }
    : { padding: '8px 14px', fontSize: 13 };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        ...styles[kind],
        ...sizing,
        borderRadius: 7,
        fontFamily: ATLAS_FONT,
        fontWeight: 500,
        lineHeight: 1,
        cursor: 'pointer',
      }}>
      {IconCmp && <IconCmp size={14} color="currentColor" />}
      {label}
    </button>
  );
}
