import React from 'react';

interface TabletFrameProps {
  children: React.ReactNode;
  width?: number;
  vertical?: boolean;
}

export function TabletFrame({ children, width = 580, vertical = false }: TabletFrameProps) {
  const ratio = vertical ? (4 / 3) : (3 / 4);
  const h = width * ratio;
  return (
    <div style={{
      width,
      height: h,
      background: '#15140f',
      borderRadius: 22,
      padding: 11,
      position: 'relative',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}>
        {children}
      </div>
      {!vertical && <div style={{
        position: 'absolute',
        left: 5,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 5,
        height: 5,
        borderRadius: 999,
        background: '#3a3933',
      }} />}
    </div>
  );
}
