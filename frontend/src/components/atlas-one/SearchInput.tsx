import React from 'react';
import { ATLAS_FONT, ATLAS_MONO, N } from './tokens';
import { Icon } from './icons/iconLib';

interface SearchInputProps {
  placeholder?: string;
  width?: number;
}

export function SearchInput({
  placeholder = 'Buscar productos, clientes, tickets…',
  width = 320,
}: SearchInputProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width,
      padding: '7px 12px',
      border: `1px solid ${N.line}`,
      borderRadius: 8,
      background: N.page,
      color: N.muted,
      fontSize: 13,
      fontFamily: ATLAS_FONT,
    }}>
      <Icon.search size={15} color={N.muted} />
      <span style={{ flex: 1, color: N.muted }}>{placeholder}</span>
      <span style={{
        fontFamily: ATLAS_MONO,
        fontSize: 10.5,
        color: N.faint,
        padding: '1px 5px',
        border: `1px solid ${N.line2}`,
        borderRadius: 4,
      }}>⌘ K</span>
    </div>
  );
}
