import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, PresetConfig } from './tokens';
import { Icon } from './icons/iconLib';

interface SidebarUserProps {
  preset: PresetConfig;
  name: string;
  role: string;
  branch: string;
}

export function SidebarUser({ preset, name, role, branch }: SidebarUserProps) {
  const sb = preset.sidebar;
  return (
    <div style={{
      marginTop: 12,
      padding: '10px 10px',
      borderTop: `1px solid ${sb.activeBg}`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: ATLAS_FONT,
    }}>
      <div style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        background: sb.accent,
        color: sb.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: 12,
      }}>{name.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: sb.fg,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{name}</div>
        <div style={{ fontSize: 10.5, color: sb.mute, fontFamily: ATLAS_MONO, letterSpacing: 0.3 }}>{role} · {branch}</div>
      </div>
      <Icon.cog size={14} color={sb.mute} />
    </div>
  );
}
