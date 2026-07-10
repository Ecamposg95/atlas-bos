import { useCallback, useEffect, useState } from 'react'
import { printerApi, type AgentPrinterCandidate } from '../../api/printer'
import { toast } from '../../store/toastStore'

interface Props {
  open: boolean
  onClose: () => void
  onInstalled?: (queueName: string) => void
}

type Step = 'detect' | 'confirm' | 'installing' | 'done'

export function PrinterInstallWizard({ open, onClose, onInstalled }: Props) {
  const [step, setStep] = useState<Step>('detect')
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<AgentPrinterCandidate[]>([])
  const [platformNote, setPlatformNote] = useState<string | null>(null)
  const [picked, setPicked] = useState<AgentPrinterCandidate | null>(null)
  const [queueName, setQueueName] = useState('')
  const [setDefault, setSetDefault] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [installedQueue, setInstalledQueue] = useState<string | null>(null)
  const [testPrintStatus, setTestPrintStatus] = useState<'idle' | 'running' | 'ok' | 'error'>('idle')
  const [testPrintError, setTestPrintError] = useState<string | null>(null)

  const runTestPrint = async () => {
    if (!installedQueue) return
    setTestPrintStatus('running')
    setTestPrintError(null)
    try {
      await printerApi.testPrintOnQueue(installedQueue, picked?.paper_width_mm ?? 80)
      setTestPrintStatus('ok')
    } catch (e: any) {
      setTestPrintStatus('error')
      setTestPrintError(e?.message ?? 'Error en test print')
    }
  }

  const scan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await printerApi.detectPrinters()
      setCandidates(r.candidates)
      setPlatformNote(r.note ?? null)
      if (r.candidates.length === 0 && !r.note) {
        setError(
          'No se detectaron impresoras USB/red. Verifica: cable conectado, impresora encendida, y que no esté en uso por otra cola.'
        )
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error escaneando impresoras')
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setStep('detect')
      setPicked(null)
      setQueueName('')
      setError(null)
      setInstalledQueue(null)
      scan()
    }
  }, [open, scan])

  const select = (c: AgentPrinterCandidate) => {
    setPicked(c)
    setQueueName(c.queue_suggestion)
    setError(null)
    setStep('confirm')
  }

  const install = async () => {
    if (!picked) return
    const name = queueName.trim()
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setError('Nombre inválido: solo letras, números, guión o guión bajo.')
      return
    }
    setStep('installing')
    setError(null)
    try {
      const res = await printerApi.installPrinter(picked.uri, name, setDefault)
      setInstalledQueue(res.queue_name)
      setStep('done')
      toast.success(`Impresora "${res.queue_name}" instalada.`)
      onInstalled?.(res.queue_name)
    } catch (e: any) {
      setError(e?.message ?? 'Error al instalar')
      setStep('confirm')
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-dax-border overflow-hidden"
        style={{ background: 'var(--dax-surface)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-dax-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-plus text-indigo-400" />
            <h2 className="text-lg font-bold text-dax-text">Instalar impresora</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-dax-muted hover:text-dax-text hover:bg-dax-card"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
            <StepDot active={step === 'detect'} done={step !== 'detect'} label="1. Detectar" />
            <span className="text-dax-faint">—</span>
            <StepDot active={step === 'confirm' || step === 'installing'} done={step === 'done'} label="2. Confirmar" />
            <span className="text-dax-faint">—</span>
            <StepDot active={step === 'done'} done={step === 'done'} label="3. Listo" />
          </div>

          {platformNote && (
            <div className="rounded-lg bg-dax-card border border-dax-border p-3 text-xs text-dax-muted">
              <i className="fa-solid fa-circle-info text-indigo-400 mr-2" />
              {platformNote}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-200">
              <i className="fa-solid fa-triangle-exclamation mr-2" />
              {error}
            </div>
          )}

          {step === 'detect' && (
            <>
              <p className="text-sm text-dax-muted">
                Conecta la impresora USB o verifica su IP de red. El agente ejecutará{' '}
                <code className="font-mono text-[11px] bg-dax-card px-1 py-0.5 rounded">lpinfo -v</code>{' '}
                para detectarla.
              </p>
              <button
                onClick={scan}
                disabled={loading}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2" /> Escaneando…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-magnifying-glass mr-2" /> Escanear otra vez
                  </>
                )}
              </button>
              {candidates.length > 0 && (
                <div className="space-y-2">
                  {candidates.map((c) => (
                    <button
                      key={c.uri}
                      onClick={() => select(c)}
                      className="w-full text-left p-3 rounded-lg border border-dax-border hover:border-indigo-500 hover:bg-dax-card transition"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-semibold text-dax-text text-sm">
                          {c.brand} · {c.model}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600/20 text-sem-success">
                          {c.paper_width_mm}mm
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-dax-muted break-all">{c.uri}</div>
                      <div className="text-[11px] text-indigo-300 mt-1">
                        Sugerido: <span className="font-mono">{c.queue_suggestion}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'confirm' && picked && (
            <>
              <div className="rounded-lg border border-dax-border bg-dax-card p-3">
                <p className="text-xs text-dax-muted uppercase tracking-widest mb-1">Impresora</p>
                <p className="text-sm font-bold text-dax-text">{picked.brand} · {picked.model}</p>
                <p className="text-[11px] font-mono text-dax-muted break-all mt-1">{picked.uri}</p>
              </div>

              <div>
                <label className="text-xs text-dax-muted block mb-1">
                  Nombre de la cola CUPS
                </label>
                <input
                  type="text"
                  value={queueName}
                  onChange={(e) => setQueueName(e.target.value)}
                  placeholder="bixolon80"
                  className="w-full px-3 py-2 rounded-lg bg-dax-bg border border-dax-border text-sm text-dax-text font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-dax-muted mt-1">
                  Sin espacios. Se usa como identificador en el sistema de impresión.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-dax-muted">
                <input
                  type="checkbox"
                  checked={setDefault}
                  onChange={(e) => setSetDefault(e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-500"
                />
                Marcar como impresora predeterminada del sistema
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setStep('detect')}
                  className="flex-1 py-2 rounded-lg border border-dax-border text-dax-muted hover:bg-dax-card text-sm"
                >
                  ← Atrás
                </button>
                <button
                  onClick={install}
                  disabled={!queueName.trim()}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Instalar en modo raw
                </button>
              </div>
            </>
          )}

          {step === 'installing' && (
            <div className="py-8 text-center">
              <i className="fa-solid fa-spinner fa-spin text-indigo-400 text-3xl" />
              <p className="text-sm text-dax-muted mt-3">Creando cola CUPS…</p>
              <p className="text-[11px] text-dax-muted mt-1">
                {'lpadmin -p {nombre} -E -v URI -m raw'.replace('{nombre}', queueName)}
              </p>
            </div>
          )}

          {step === 'done' && installedQueue && (
            <div className="py-6 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <i className="fa-solid fa-check text-sem-success text-2xl" />
              </div>
              <div>
                <p className="text-lg font-bold text-dax-text">Impresora instalada</p>
                <p className="text-sm text-dax-muted mt-1">
                  Cola <code className="font-mono text-indigo-300">{installedQueue}</code> en modo raw,
                  activa y aceptando trabajos.
                </p>
                {testPrintStatus === 'ok' && (
                  <p className="text-[11px] text-sem-success mt-2">
                    <i className="fa-solid fa-check mr-1" />
                    Ticket de prueba enviado. Verifica que salió completo y la regla
                    llegó al borde derecho.
                  </p>
                )}
                {testPrintStatus === 'error' && (
                  <p className="text-[11px] text-rose-300 mt-2">
                    <i className="fa-solid fa-xmark mr-1" />
                    Falló el test: {testPrintError}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={runTestPrint}
                  disabled={testPrintStatus === 'running'}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {testPrintStatus === 'running' ? (
                    <><i className="fa-solid fa-spinner fa-spin mr-2" /> Enviando ticket de prueba…</>
                  ) : testPrintStatus === 'ok' ? (
                    <><i className="fa-solid fa-rotate-right mr-2" /> Reenviar prueba</>
                  ) : (
                    <><i className="fa-solid fa-paper-plane mr-2" /> Imprimir ticket de prueba</>
                  )}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setStep('detect'); setPicked(null); setTestPrintStatus('idle'); scan()
                    }}
                    className="flex-1 py-2 rounded-lg border border-dax-border text-dax-muted hover:bg-dax-card text-sm"
                  >
                    Instalar otra
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  let classes = 'text-dax-faint'
  if (done) classes = 'text-sem-success'
  else if (active) classes = 'text-indigo-300'
  return <span className={classes}>{label}</span>
}
