import React from 'react';
import { ATLAS_FONT, N } from '../tokens';

interface PhoneFrameProps {
  children: React.ReactNode;
  width?: number;
}

export function PhoneFrame({ children, width = 280 }: PhoneFrameProps) {
  const h = width * (844 / 390);
  return (
    <div style={{
      width,
      height: h,
      background: '#0e0d0a',
      borderRadius: 34,
      padding: 8,
      position: 'relative',
      boxShadow: 'inset 0 0 0 1px #2a2925',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 28,
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 6,
          transform: 'translateX(-50%)',
          width: 78,
          height: 20,
          borderRadius: 999,
          background: '#0e0d0a',
          zIndex: 5,
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 32,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 22px 0',
          fontSize: 11,
          fontFamily: ATLAS_FONT,
          fontWeight: 600,
          color: N.ink,
          zIndex: 4,
        }}>
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center', opacity: 0.9 }}>
            <svg width={14} height={9} viewBox="0 0 14 9">
              <path d="M1 7l2-2 2 2 3-4 5 4" stroke="currentColor" strokeWidth={1.4} fill="none" strokeLinecap="round" />
            </svg>
            <span style={{
              width: 18,
              height: 9,
              border: '1px solid currentColor',
              borderRadius: 2,
              position: 'relative',
              display: 'inline-block',
            }}>
              <span style={{
                position: 'absolute',
                inset: 1,
                width: '70%',
                background: 'currentColor',
                borderRadius: 1,
              }} />
            </span>
          </span>
        </div>
        <div style={{ paddingTop: 32, height: '100%' }}>{children}</div>
      </div>
    </div>
  );
}
