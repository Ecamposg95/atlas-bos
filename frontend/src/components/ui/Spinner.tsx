interface Props {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

const sizeMap = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
}

export function Spinner({ size = 'md', text }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
      <i className={`fa fa-spinner fa-spin ${sizeMap[size]}`} />
      {text && <p className="text-sm">{text}</p>}
    </div>
  )
}
