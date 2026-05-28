import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, PresetConfig } from './tokens';
import { Wordmark } from './Wordmark';
import type { IconComponent } from './icons/iconLib';

export type SidebarItem =
  | { header: string }
  | { icon?: IconComponent; label: string; badge?: string | number };

interface SidebarProps {
  preset: PresetConfig;
  active?: string;
  items: SidebarItem[];
  footer?: React.ReactNode;
  width?: number;
}

export function Sidebar({ preset, active, items, footer, width = 232 }: SidebarProps) {
  const sb = preset.sidebar;
  return (
    <aside style={{
      width,
      flexShrink: 0,
      background: sb.bg,
      color: sb.fg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: ATLAS_FONT,
      padding: '20px 14px 16px',
    }}>
      <div style={{ padding: '4px 6px 22px' }}>
        <Wordmark color={sb.fg} accent={sb.accent} size={15} sub={preset.tagline} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map((it, i) => {
          if ('header' in it) {
            return (
              <div key={i} style={{
                fontFamily: ATLAS_MONO,
                fontSize: 10,
                color: sb.mute,
                padding: '14px 10px 6px',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>{it.header}</div>
            );
          }
          const isActive = it.label === active;
          const IconCmp = it.icon;
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 7,
              background: isActive ? sb.activeBg : 'transparent',
              color: isActive ? sb.fg : sb.mute,
              fontSize: 13.5,
              fontWeight: isActive ? 500 : 400,
              position: 'relative',
            }}>
              {isActive && <span style={{
                position: 'absolute',
                left: -14,
                top: 8,
                bottom: 8,
                width: 2,
                borderRadius: 2,
                background: sb.accent,
              }} />}
              {IconCmp && <IconCmp size={16} color={isActive ? sb.accent : sb.mute} />}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge != null && (
                <span style={{
                  fontFamily: ATLAS_MONO,
                  fontSize: 10,
                  fontWeight: 500,
                  background: isActive ? sb.accent : 'rgba(255,255,255,0.08)',
                  color: isActive ? sb.bg : sb.mute,
                  padding: '2px 6px',
                  borderRadius: 999,
                  minWidth: 18,
                  textAlign: 'center',
                }}>{it.badge}</span>
              )}
            </div>
          );
        })}
      </div>
      {footer}
    </aside>
  );
}
