import { useCallback, useEffect, useState } from 'react'
import { printerApi, type AgentDiagnostics, type AgentCupsQueue } from '../../api/printer'
import { toast } from '../../store/toastStore'

interface Props {
  className?: string
  autoRefreshMs?: number
}

/**
 * Banner + panel desplegable con el reporte /diagnostics del agente local.
 *
 * Rojo si hay issues (bloqueantes), ámbar si solo warnings, verde si todo ok.
 * Ofrece un botón "Reintentar" y lista problemas accionables (p.ej.
 * "CUPS no corriendo" → muestra comando sudo).
 */
export function AgentDiagnosticsPanel({ className = '', autoRefreshMs = 10_000 }: Props) {
  const [diag, setDiag] = useState<AgentDiagnostics | null | 'offline'>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [setupRunning, setSetupRunning] = useState(false)
  const [spoolerRunning, setSpoolerRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await printerApi.getDiagnostics()
    setDiag(data ?? 'offline')
    setLoading(false)
  }, [])

  const runSystemSetup = useCallback(async () => {
    setSetupRunning(true)
    toast.info('Instalando CUPS y drivers… acepta el diálogo de administrador. Puede tardar varios minutos.')
    try {
      const res = await printerApi.systemSetup()
      if (res.status === 'ok') {
        toast.success(
          res.needs_relogin
            ? 'Sistema actualizado. Cierra sesión y vuelve a entrar para aplicar permisos de impresión.'
            : 'Sistema y drivers actualizados correctamente.',
        )
      } else {
        toast.error(`Terminó con errores: ${res.stderr.slice(-200) || 'revisa el log del agente'}`)
      }
      await load()
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo actualizar el sistema')
    } finally {
      setSetupRunning(false)
    }
  }, [load])

  const runSpoolerRepair = useCallback(async () => {
    setSpoolerRunning(true)
    toast.info('Reparando Print Spooler… acepta el diálogo de Administrador (UAC) si aparece.')
    try {
      const res = await printerApi.repairSpooler()
      if (res.running) toast.success(res.message)
      else toast.error(res.message)
      await load()
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo reparar el spooler')
    } finally {
      setSpoolerRunning(false)
    }
  }, [load])

  useEffect(() => {
    load()
    if (autoRefreshMs > 0) {
      const id = window.setInterval(load, autoRefreshMs)
      return () => window.clearInterval(id)
    }
  }, [load, autoRefreshMs])

  // Banner compacto
  if (diag === 'offline') {
    return (
      <div className={`rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 ${className}`}>
        <div className="flex items-start gap-3">
          <i className="fa-solid fa-circle-exclamation text-rose-400 text-lg mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Agente de impresión offline</p>
            <p className="text-xs text-slate-400 mt-0.5">
              No hay respuesta en <code className="font-mono">https://localhost:9100</code>.
              Abre el ejecutable del agente y acepta el certificado autofirmado la primera vez.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md bg-rose-600/20 text-rose-200 border border-rose-600/30 hover:bg-rose-600/30 disabled:opacity-50"
          >
            {loading ? 'Verificando…' : 'Reintentar'}
          </button>
        </div>
      </div>
    )
  }

  if (!diag) return null

  const hasIssues = diag.issues.length > 0
  const hasWarnings = diag.warnings.length > 0
  const statusColor = hasIssues ? 'rose' : hasWarnings ? 'amber' : 'emerald'
  const statusIcon = hasIssues
    ? 'fa-circle-exclamation'
    : hasWarnings
    ? 'fa-triangle-exclamation'
    : 'fa-circle-check'
  const statusText = hasIssues
    ? `${diag.issues.length} problema${diag.issues.length === 1 ? '' : 's'} de configuración`
    : hasWarnings
    ? `${diag.warnings.length} aviso${diag.warnings.length === 1 ? '' : 's'}`
    : `Agente OK · v${diag.version} · ${diag.os}`

  const colorClasses: Record<string, { border: string; bg: string; icon: string; hover: string }> = {
    rose:    { border: 'border-rose-500/40',    bg: 'bg-rose-500/10',    icon: 'text-rose-400',    hover: 'hover:bg-rose-600/20' },
    amber:   { border: 'border-amber-500/40',   bg: 'bg-amber-500/10',   icon: 'text-amber-400',   hover: 'hover:bg-amber-600/20' },
    emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', icon: 'text-emerald-400', hover: 'hover:bg-emerald-600/20' },
  }
  const c = colorClasses[statusColor]

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} ${className}`}>
      <button
        onClick={() => setExpanded((x) => !x)}
        className={`w-full flex items-center gap-3 p-3 text-left rounded-xl transition ${c.hover}`}
      >
        <i className={`fa-solid ${statusIcon} ${c.icon} text-lg`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{statusText}</p>
          <p className="text-[11px] text-slate-400">
            {diag.os} · {diag.os_release ?? ''} · {diag.queues_count != null ? `${diag.queues_count} colas` : ''}
            {diag.raw_queues_count != null && ` (${diag.raw_queues_count} raw)`}
          </p>
        </div>
        <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-700/40 px-4 py-3 space-y-3 text-xs">
          {diag.issues.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300 mb-1">
                Problemas (requieren acción)
              </p>
              <ul className="space-y-1">
                {diag.issues.map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-rose-200">
                    <i className="fa-solid fa-circle-xmark text-[10px] mt-1" />
                    <span className="font-mono leading-snug">{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diag.warnings.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300 mb-1">
                Avisos
              </p>
              <ul className="space-y-1">
                {diag.warnings.map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-amber-200">
                    <i className="fa-solid fa-triangle-exclamation text-[10px] mt-1" />
                    <span className="font-mono leading-snug">{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400 pt-1">
            <div><span className="text-slate-500">Versión:</span> <span className="text-white font-mono">v{diag.version}</span></div>
            <div><span className="text-slate-500">Sistema:</span> <span className="text-white">{diag.os}</span></div>
            {diag.cert?.exists && (
              <>
                <div><span className="text-slate-500">Cert SSL:</span> <span className="text-white">{diag.cert.valid ? 'válido' : 'inválido'}</span></div>
                {diag.cert.expires_in_days != null && (
                  <div><span className="text-slate-500">Vence en:</span> <span className="text-white">{diag.cert.expires_in_days}d</span></div>
                )}
              </>
            )}
            {diag.os !== 'Windows' && (
              <>
                <div><span className="text-slate-500">CUPS:</span> <span className="text-white">{diag.cups_daemon_running ? 'activo' : 'detenido'}</span></div>
                <div><span className="text-slate-500">lp:</span> <span className="text-white font-mono text-[10px]">{diag.lp_path ?? '—'}</span></div>
              </>
            )}
            {diag.os === 'Windows' && (
              <>
                <div><span className="text-slate-500">Spooler:</span> <span className="text-white">{diag.spooler_running ? 'activo' : 'detenido'}</span></div>
                <div><span className="text-slate-500">pywin32:</span> <span className="text-white">{diag.win32print_available ? 'ok' : 'faltante'}</span></div>
              </>
            )}
          </div>

          {diag.queues && diag.queues.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Colas CUPS
              </p>
              <div className="space-y-1">
                {diag.queues.map((q) => (
                  <QueueRow key={q.name} queue={q} onChange={load} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={load}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? 'Verificando…' : 'Actualizar'}
            </button>
            {diag.os === 'Linux' && (
              <button
                onClick={runSystemSetup}
                disabled={setupRunning}
                title="Actualiza el sistema e instala CUPS + drivers de impresora (pide autorización de administrador)"
                className="text-xs px-3 py-1.5 rounded-md bg-indigo-600/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-600/30 disabled:opacity-50"
              >
                <i className="fa-solid fa-download mr-1.5" />
                {setupRunning ? 'Instalando…' : 'Actualizar sistema y drivers'}
              </button>
            )}
            {diag.os === 'Windows' && (
              <button
                onClick={runSpoolerRepair}
                disabled={spoolerRunning}
                title="Deja el Print Spooler en inicio automático y lo arranca (pide autorización UAC)"
                className="text-xs px-3 py-1.5 rounded-md bg-indigo-600/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-600/30 disabled:opacity-50"
              >
                <i className="fa-solid fa-wrench mr-1.5" />
                {spoolerRunning ? 'Reparando…' : 'Reparar Print Spooler'}
              </button>
            )}
            <a
              href="https://localhost:9100/diagnostics"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Abrir JSON crudo
            </a>
          </div>
        </div>
      )}
    </div>
  )
}


function QueueRow({ queue, onChange }: { queue: AgentCupsQueue; onChange: () => void }) {
  const [busy, setBusy] = useState(false)

  const wrap = async (action: () => Promise<unknown>, okMsg: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(okMsg)
      onChange()
    } catch (e: any) {
      toast.error(e?.message ?? 'Error')
    } finally {
      setBusy(false)
    }
  }

  const handleTest = () =>
    wrap(() => printerApi.testPrintOnQueue(queue.name, 80), `Prueba enviada a ${queue.name}`)
  const handlePause = () =>
    wrap(() => printerApi.pausePrinter(queue.name), `${queue.name} pausada`)
  const handleResume = () =>
    wrap(() => printerApi.resumePrinter(queue.name), `${queue.name} reactivada`)
  const handleClear = () =>
    wrap(() => printerApi.clearPrinterQueue(queue.name), `Cola ${queue.name} limpiada`)
  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar la cola "${queue.name}"? Se elimina de CUPS con lpadmin -x.`)) return
    await wrap(() => printerApi.uninstallPrinter(queue.name), `${queue.name} eliminada`)
  }

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-slate-800/40">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-white truncate max-w-[140px]">{queue.name}</span>
        {queue.is_raw ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300" title="Cola en modo raw">raw</span>
        ) : (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-300"
            title="No es raw — puede producir basura en impresoras térmicas ESC/POS"
          >
            driver
          </span>
        )}
        <span className={`text-[10px] ${queue.enabled && queue.accepting ? 'text-emerald-400' : 'text-slate-500'}`}>
          {queue.enabled ? (queue.accepting ? 'ok' : 'pausada') : 'deshabilitada'}
        </span>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <IconBtn icon="fa-paper-plane" title="Imprimir prueba" onClick={handleTest} busy={busy} />
        {queue.enabled ? (
          <IconBtn icon="fa-pause" title="Pausar" onClick={handlePause} busy={busy} />
        ) : (
          <IconBtn icon="fa-play" title="Reactivar" onClick={handleResume} busy={busy} />
        )}
        <IconBtn icon="fa-broom" title="Limpiar cola" onClick={handleClear} busy={busy} />
        <IconBtn icon="fa-trash" title="Eliminar" onClick={handleDelete} busy={busy} danger />
      </div>
    </div>
  )
}

function IconBtn({
  icon, title, onClick, busy, danger,
}: { icon: string; title: string; onClick: () => void; busy: boolean; danger?: boolean }) {
  const color = danger
    ? 'text-slate-400 hover:text-rose-300 hover:bg-rose-500/10'
    : 'text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10'
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      className={`p-1.5 rounded text-xs ${color} disabled:opacity-40`}
    >
      <i className={`fa-solid ${icon}`} />
    </button>
  )
}
