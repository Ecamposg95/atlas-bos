/**
 * StatusBadge — badge reutilizable para estados de documentos.
 *
 * Mapea estados comunes (QUOTE, SALE, RETURN, DRAFT, CANCELLED, PAID, PENDING)
 * a colores semánticos con paleta consistente. Fallback a neutro si el
 * status no está mapeado.
 *
 * @example
 *   <StatusBadge status="PAID" />
 *   <StatusBadge status="CANCELLED" variant="outline" size="sm" />
 */

import type { HTMLAttributes } from 'react'

export type KnownStatus =
  | 'QUOTE'
  | 'SALE'
  | 'RETURN'
  | 'DRAFT'
  | 'CANCELLED'
  | 'PAID'
  | 'PENDING'

export type StatusBadgeVariant = 'solid' | 'outline' | 'soft'
export type StatusBadgeSize = 'sm' | 'md' | 'lg'

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Estado a representar. Acepta también strings arbitrarios — fallback neutro. */
  status: KnownStatus | string
  /** Estilo visual: solid (fondo saturado), outline (borde), soft (fondo tenue). Default: `"soft"`. */
  variant?: StatusBadgeVariant
  /** Tamaño del badge. Default: `"md"`. */
  size?: StatusBadgeSize
  /** Label visible; si se omite, se usa el status traducido (o Title Case). */
  label?: string
}

type PaletteKey = 'blue' | 'green' | 'orange' | 'gray' | 'red' | 'emerald' | 'yellow' | 'neutral'

const STATUS_PALETTE: Record<KnownStatus, PaletteKey> = {
  QUOTE: 'blue',
  SALE: 'green',
  RETURN: 'orange',
  DRAFT: 'gray',
  CANCELLED: 'red',
  PAID: 'emerald',
  PENDING: 'yellow',
}

const STATUS_LABEL: Record<KnownStatus, string> = {
  QUOTE: 'Cotización',
  SALE: 'Venta',
  RETURN: 'Devolución',
  DRAFT: 'Borrador',
  CANCELLED: 'Cancelado',
  PAID: 'Pagado',
  PENDING: 'Pendiente',
}

const PALETTE: Record<PaletteKey, Record<StatusBadgeVariant, string>> = {
  blue: {
    solid: 'bg-blue-600 text-white',
    outline: 'border border-blue-500/40 text-blue-300',
    soft: 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
  },
  green: {
    solid: 'bg-green-600 text-white',
    outline: 'border border-green-500/40 text-green-300',
    soft: 'bg-green-500/10 text-green-300 border border-green-500/20',
  },
  orange: {
    solid: 'bg-orange-600 text-white',
    outline: 'border border-orange-500/40 text-orange-300',
    soft: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
  },
  gray: {
    solid: 'bg-slate-600 text-white',
    outline: 'border border-slate-500/40 text-dax-muted',
    soft: 'bg-slate-500/10 text-dax-muted border border-slate-500/20',
  },
  red: {
    solid: 'bg-red-600 text-white',
    outline: 'border border-red-500/40 text-red-300',
    soft: 'bg-red-500/10 text-red-300 border border-red-500/20',
  },
  emerald: {
    solid: 'bg-emerald-600 text-white',
    outline: 'border border-emerald-500/40 text-sem-success',
    soft: 'bg-emerald-500/10 text-sem-success border border-emerald-500/20',
  },
  yellow: {
    solid: 'bg-yellow-500 text-slate-900',
    outline: 'border border-yellow-500/40 text-yellow-300',
    soft: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20',
  },
  neutral: {
    solid: 'bg-dax-surface text-dax-text',
    outline: 'border border-dax-border text-dax-muted',
    soft: 'bg-dax-surface text-dax-muted border border-dax-border',
  },
}

const SIZE_CLASSES: Record<StatusBadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-3 py-1',
}

function titleCase(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function StatusBadge({
  status,
  variant = 'soft',
  size = 'md',
  label,
  className = '',
  ...rest
}: StatusBadgeProps) {
  const known = (STATUS_PALETTE as Record<string, PaletteKey | undefined>)[status]
  const paletteKey: PaletteKey = known ?? 'neutral'
  const palette = PALETTE[paletteKey][variant]
  const sizeClasses = SIZE_CLASSES[size]

  const display =
    label ??
    (STATUS_LABEL as Record<string, string | undefined>)[status] ??
    titleCase(status)

  return (
    <span
      role="status"
      aria-label={display}
      className={`inline-flex items-center gap-1 rounded-full font-semibold tracking-wide ${palette} ${sizeClasses} ${className}`.trim()}
      {...rest}
    >
      {display}
    </span>
  )
}

export default StatusBadge
