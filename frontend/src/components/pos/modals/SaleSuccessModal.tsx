import { useEffect } from 'react'
import { formatCurrency } from '../../../utils/currency'

interface Props {
  folio: string
  total: number
  change: number
  onPrint: () => void
  onClose: () => void
}

export function SaleSuccessModal({ folio, total, change, onPrint, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'var(--dax-modal-backdrop)' }}
    >
      <div className="dax-card p-8 w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <i className="fa-solid fa-check text-sem-success text-4xl" />
        </div>

        <h3 className="text-2xl font-black text-dax-text mb-1">¡Venta Exitosa!</h3>
        <p className="text-indigo-400 font-mono text-sm mb-6">{folio}</p>

        <div className="space-y-2 mb-6 text-sm">
          <div className="flex justify-between text-dax-muted">
            <span>Total cobrado</span>
            <span className="font-bold text-dax-text tabular-nums">{formatCurrency(total)}</span>
          </div>
          {change > 0 && (
            <div className="flex justify-between text-dax-muted">
              <span>Cambio</span>
              <span className="font-bold text-sem-success tabular-nums">{formatCurrency(change)}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={onPrint}
            className="w-full dax-btn-secondary py-3 justify-center text-sm"
          >
            <i className="fa-solid fa-print" /> Imprimir Ticket
          </button>
          <button
            onClick={onClose}
            className="w-full dax-btn-primary py-3 justify-center text-base"
          >
            <i className="fa-solid fa-plus" /> Nueva Venta
          </button>
        </div>
      </div>
    </div>
  )
}
