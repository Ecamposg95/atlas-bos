/**
 * ErrorState — estado de error de red/API con botón "Reintentar".
 *
 * Antipatrón que reemplaza: `catch → setItems([])`, que muestra "Sin datos"
 * cuando en realidad falló el API. Un fallo de red NUNCA debe verse igual
 * que una lista vacía real.
 *
 * Uso típico:
 *   const [error, setError] = useState(false)
 *   const load = async () => {
 *     setError(false)
 *     try { setItems(await api.list()) } catch { setError(true) }
 *   }
 *   ...
 *   {error ? <ErrorState onRetry={load} /> : <Tabla items={items} />}
 */
import type { ReactNode } from 'react'

export interface ErrorStateProps {
  /** Mensaje principal. Default: aviso genérico de conexión. */
  message?: ReactNode
  /** Reintenta la carga. Si se omite, no se muestra el botón. */
  onRetry?: () => void
  /** Versión compacta para paneles pequeños (menos padding, sin icono grande). */
  compact?: boolean
}

export function ErrorState({ message, onRetry, compact = false }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center gap-3 ${compact ? 'py-6 px-4' : 'py-12 px-6'}`}
      style={{ color: 'var(--dax-text-muted)' }}
    >
      {!compact && (
        <i className="fa-solid fa-cloud-bolt text-2xl" aria-hidden="true" style={{ color: 'var(--dax-text-faint)' }} />
      )}
      <p className="text-sm max-w-sm leading-relaxed m-0">
        {message ?? 'No se pudo cargar la información. Verifica tu conexión.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{
            background: 'var(--p-accent-soft)',
            color: 'var(--dax-accent)',
            border: '1px solid transparent',
          }}
        >
          <i className="fa-solid fa-rotate-right text-xs" aria-hidden="true" />
          Reintentar
        </button>
      )}
    </div>
  )
}

export default ErrorState
