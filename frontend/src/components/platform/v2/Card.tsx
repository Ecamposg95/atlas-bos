import type { ReactNode, CSSProperties } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
  flush?: boolean
  style?: CSSProperties
}

export function Card({ title, subtitle, right, children, flush, style }: CardProps) {
  return (
    <div className="card" style={style}>
      {(title || right) && (
        <div className="head">
          <div className="title">
            {title}
            {subtitle && <span className="big">{subtitle}</span>}
          </div>
          {right}
        </div>
      )}
      <div className={'body' + (flush ? ' flush' : '')}>{children}</div>
    </div>
  )
}
