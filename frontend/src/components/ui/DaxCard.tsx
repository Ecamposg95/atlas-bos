interface Props {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function DaxCard({ children, className = '', padding = true }: Props) {
  return (
    <div className={`dax-card ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}
