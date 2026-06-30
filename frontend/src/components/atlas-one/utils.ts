/**
 * Atlas One formatting helpers
 * Source: C:\Users\ecamp\Devs\Atlas Brain\AtlasONE\ATLAS ONE\system.jsx (lines 602-608)
 */

export function mxn(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function mxnInt(n: number): string {
  return '$' + n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
}
