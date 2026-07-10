import { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: string
}

const variantMap: Record<Variant, string> = {
  primary: 'dax-btn-primary',
  secondary: 'dax-btn-secondary',
  danger: 'dax-btn-danger',
  ghost: 'text-dax-muted hover:text-dax-text hover:bg-dax-surface px-3 py-2 rounded-lg transition-colors',
}

const sizeMap = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-6 py-3',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: Props) {
  return (
    <button
      className={`${variantMap[variant]} ${sizeMap[size]} inline-flex items-center gap-2 ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <i className="fa fa-spinner fa-spin text-sm" />
      ) : icon ? (
        <i className={`${icon} text-sm`} />
      ) : null}
      {children}
    </button>
  )
}
