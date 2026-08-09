import React from 'react';

interface LaptopFrameProps {
  children: React.ReactNode;
  width?: number;
}

export function LaptopFrame({ children, width = 720 }: LaptopFrameProps) {
  const h = width * 0.62;
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: '100%',
        background: '#1c1b18',
        borderRadius: '14px 14px 4px 4px',
        padding: '10px 10px 12px',
        position: 'relative',
      }}>
        <div style={{
          background: '#0a0a09',
          borderRadius: 4,
          overflow: 'hidden',
          width: '100%',
          height: h - 22,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 4,
            transform: 'translateX(-50%)',
            width: 6,
            height: 6,
            borderRadius: 999,
            background: '#000',
            border: '1px solid #2a2a28',
            zIndex: 2,
          }} />
          <div style={{
            position: 'absolute',
            inset: '12px 6px 6px',
            background: '#fff',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            {children}
          </div>
        </div>
      </div>
      <div style={{
        width: '108%',
        height: 9,
        background: 'linear-gradient(180deg, #c5c2bb 0%, #8e8b84 100%)',
        borderRadius: '0 0 9px 9px',
      }} />
      <div style={{
        width: 60,
        height: 4,
        background: '#5a5751',
        borderRadius: '0 0 4px 4px',
        marginTop: -1,
      }} />
    </div>
  );
}
