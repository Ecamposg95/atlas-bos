import React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/**
 * Internal factory for stroke icons (lucide-style, 1.6 stroke, 24×24 viewBox).
 * Source: C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\system.jsx (lines 159-163)
 */
const I = (path: React.ReactNode, vb = 24) =>
  ({ size = 18, color = 'currentColor', strokeWidth = 1.6, style = {} }: IconProps = {}) => (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vb} ${vb}`}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      {path}
    </svg>
  );

export const Icon = {
  home:       I(<><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/></>),
  cart:       I(<><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/><path d="M3 4h2l2.5 11h11l2-8H6"/></>),
  box:        I(<><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></>),
  users:      I(<><circle cx="9" cy="9" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.5"/><path d="M17 13c2.8 0 5 2.2 5 5"/></>),
  user:       I(<><circle cx="12" cy="9" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></>),
  chart:      I(<><path d="M4 20V8M10 20V4M16 20v-8M22 20H2"/></>),
  bars:       I(<><rect x="4" y="11" width="3" height="9"/><rect x="10.5" y="7" width="3" height="13"/><rect x="17" y="14" width="3" height="6"/></>),
  bank:       I(<><path d="M3 9l9-5 9 5M5 9v9M19 9v9M9 9v9M15 9v9M3 20h18"/></>),
  branch:     I(<><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></>),
  calendar:   I(<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></>),
  scissors:   I(<><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4L8.5 16M14.5 10L20 20M8.5 8L13 12.5"/></>),
  table:      I(<><rect x="3" y="6" width="18" height="14" rx="1.5"/><path d="M3 11h18M9 11v9M15 11v9"/></>),
  utensils:   I(<><path d="M5 3v7c0 1.5 1 2.5 2.5 2.5S10 11.5 10 10V3M7.5 12.5V21"/><path d="M17 3c-1.5 0-3 2-3 5s1 4 2 4v9"/></>),
  flame:      I(<><path d="M12 3s4 4 4 9a4 4 0 11-8 0c0-3 2-4 2-4s-1 4 2 4 2-3 0-9z"/></>),
  search:     I(<><circle cx="11" cy="11" r="6.5"/><path d="M21 21l-5-5"/></>),
  bell:       I(<><path d="M6 16V11a6 6 0 1112 0v5l1.5 2H4.5L6 16z"/><path d="M10 21h4"/></>),
  plus:       I(<><path d="M12 5v14M5 12h14"/></>),
  arrowRight: I(<><path d="M5 12h14M13 6l6 6-6 6"/></>),
  arrowUp:    I(<><path d="M12 19V5M6 11l6-6 6 6"/></>),
  arrowDown:  I(<><path d="M12 5v14M6 13l6 6 6-6"/></>),
  cog:        I(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.4H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></>),
  receipt:    I(<><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3z"/><path d="M9 8h6M9 12h6M9 16h4"/></>),
  card:       I(<><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19"/></>),
  cash:       I(<><rect x="2.5" y="6" width="19" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></>),
  qr:         I(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></>),
  printer:    I(<><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M6 17h12v4H6z"/></>),
  fire:       I(<><path d="M12 2c0 4-5 5-5 11a5 5 0 0010 0c0-2-1-3-2-4 0 2-1 3-2 3 1-3-1-7-1-10z"/></>),
  pkg:        I(<><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M16.5 5.2L7.5 9.5M3 7l9 4 9-4M12 11v10"/></>),
  tag:        I(<><path d="M3 12V3h9l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.4"/></>),
  truck:      I(<><rect x="2" y="7" width="11" height="9" rx="1"/><path d="M13 10h5l3 3v3h-8M5 16a2 2 0 104 0M16 16a2 2 0 104 0"/></>),
  warning:    I(<><path d="M12 3l10 17H2L12 3z"/><path d="M12 10v5M12 18v.5"/></>),
  check:      I(<path d="M4 12l5 5 11-12"/>),
  clock:      I(<><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>),
  star:       I(<path d="M12 3l2.7 5.7 6.3.9-4.5 4.4 1 6.3L12 17.3l-5.6 3 1.1-6.3L3 9.6l6.3-.9L12 3z"/>),
  phone:      I(<><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 19h4"/></>),
  more:       I(<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>),
  filter:     I(<><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></>),
  download:   I(<><path d="M12 4v12M6 11l6 6 6-6M4 20h16"/></>),
  document:   I(<><path d="M6 3h8l5 5v13H6V3z"/><path d="M14 3v5h5"/></>),
  sparkles:   I(<><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></>),
  building:   I(<><path d="M3 21V6l7-3v18M10 21V9l11 3v9M3 21h18M14 13v2M14 17v2M17 13v2M17 17v2"/></>),
  beaker:     I(<><path d="M9 3h6M10 3v6L5 19c-.6 1 .2 2 1.4 2h11.2c1.2 0 2-1 1.4-2L14 9V3"/><path d="M7 15h10"/></>),
  heart:      I(<path d="M12 20s-8-5-8-12a4 4 0 017-2 4 4 0 017 2c0 7-8 12-8 12z"/>),
  pulse:      I(<><path d="M3 12h4l2-6 4 12 2-6h6"/></>),
  cross:      I(<><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></>),
  coffee:     I(<><path d="M4 8h13v8a4 4 0 01-4 4H8a4 4 0 01-4-4V8z"/><path d="M17 10h2a2 2 0 010 4h-2"/><path d="M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2"/></>),
  wine:       I(<><path d="M7 3h10c0 5-2 8-5 8s-5-3-5-8z"/><path d="M12 11v8M9 21h6"/></>),
  cocktail:   I(<><path d="M3 4h18l-9 10v6M8 21h8"/></>),
  wrench:     I(<><path d="M15 6a4 4 0 11-1.8 7.6L5 22l-3-3 8.4-8.2A4 4 0 0115 6z"/></>),
  layers:     I(<><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 18l9 5 9-5"/></>),
  shield:     I(<><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/></>),
  zap:        I(<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>),
};

export type IconKey = keyof typeof Icon;
export type IconComponent = (props?: IconProps) => JSX.Element;
