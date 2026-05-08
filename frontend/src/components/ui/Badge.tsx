type Variant = 'green' | 'red' | 'yellow' | 'blue' | 'slate'

const MAP: Record<Variant, string> = {
  green:  'dax-badge dax-badge-green',
  red:    'dax-badge dax-badge-red',
  yellow: 'dax-badge dax-badge-yellow',
  blue:   'dax-badge dax-badge-blue',
  slate:  'dax-badge dax-badge-slate',
}

interface Props {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'slate', children, className = '' }: Props) {
  return <span className={`${MAP[variant]} ${className}`}>{children}</span>
}
