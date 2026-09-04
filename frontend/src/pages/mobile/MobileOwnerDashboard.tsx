import { useCallback, useEffect, useState } from 'react'
import { reportsApi } from '../../api/reports'
import { cashApi } from '../../api/cash'
import { useAuthStore } from '../../store/authStore'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../utils/currency'
import { todayStr } from '../../utils/dates'
import {
  resumirDia,
  barrasPorHora,
  estadoDelCorte,
  type ResumenDia,
  type BarraHora,
  type EstadoCorte,
} from '../../utils/panelDia'

/**
 * Panel del dueño en móvil: cómo va el día, ritmo por hora, más vendidos y el
 * estado del corte. Tres fuentes en paralelo con `Promise.allSettled` — si una
 * falla, las demás se muestran igual y el panel dice qué no pudo cargar.
 */
export function MobileOwnerDashboard() {
  const org = useAuthStore((s) => s.org)
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [barras, setBarras] = useState<BarraHora[] | null>(null)
  const [corte, setCorte] = useState<EstadoCorte | null>(null)
  const [fallas, setFallas] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    setFallas([])
    const hoy = todayStr()
    const [rs, rh, rc] = await Promise.allSettled([
      reportsApi.dailySummary(hoy),
      reportsApi.salesByHour({ date: hoy }),
      cashApi.getStatus(),
    ])

    const fallidas: string[] = []
    if (rs.status === 'fulfilled') setResumen(resumirDia(rs.value))
    else fallidas.push('la venta del día')
    if (rh.status === 'fulfilled') setBarras(barrasPorHora(rh.value))
    else fallidas.push('el ritmo por hora')

    // `null` cuando la venta del día falló: es "no lo sé", no "no hubo efectivo" —
    // con la caja abierta, `estadoDelCorte` no calcula `deberiaHaber` en ese caso.
    const efectivo = rs.status === 'fulfilled' ? (rs.value.payments?.CASH ?? 0) : null
    if (rc.status === 'fulfilled') setCorte(estadoDelCorte(rc.value, efectivo))
    else fallidas.push('el corte de caja')

    setFallas(fallidas)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (cargando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner text="Cargando el día…" />
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* Cabecera */}
      <div className="px-4 py-3">
        <p className="text-xs text-slate-400">Resumen de hoy</p>
        <h1 className="text-xl font-black text-white truncate">{org?.name ?? 'Mi negocio'}</h1>
      </div>

      {/* Franja de fallas parciales */}
      {fallas.length > 0 && (
        <div className="mx-4 mb-1 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-300 min-w-0">
            No se pudo cargar: {fallas.join(', ')}.
          </p>
          <button
            type="button"
            onClick={cargar}
            className="shrink-0 text-xs font-bold text-amber-300 underline min-h-[32px] px-1"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Bloque 1: cómo va el día */}
      {resumen && (
        <section className="px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Cómo va el día
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-xl bg-slate-800/60 p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ventas</p>
              <p className="text-lg font-black text-emerald-400 tabular-nums truncate">{formatCurrency(resumen.venta)}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-slate-800/60 p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tickets</p>
              <p className="text-lg font-black text-white tabular-nums truncate">{resumen.tickets}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-slate-800/60 p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Utilidad</p>
              <p className="text-lg font-black text-indigo-400 tabular-nums truncate">{formatCurrency(resumen.utilidad)}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-slate-800/60 p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ticket prom.</p>
              <p className="text-lg font-black text-white tabular-nums truncate">{formatCurrency(resumen.ticketPromedio)}</p>
            </div>
          </div>
        </section>
      )}

      {/* Bloque 2: ritmo por hora */}
      {barras && barras.length > 0 && (
        <section className="px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Ritmo del día
          </h2>
          <div className="flex flex-col gap-2">
            {barras.map((b) => (
              <div key={b.hora} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3">
                <span className="text-xs tabular-nums text-slate-400">{b.hora}h</span>
                <div className="h-5 rounded bg-slate-700/40 overflow-hidden">
                  <div className="h-full rounded bg-emerald-500" style={{ width: `${b.porcentaje}%` }} />
                </div>
                <span className="text-xs tabular-nums text-slate-300">
                  {formatCurrency(b.importe)} · {b.tickets}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bloque 3: más vendidos */}
      {resumen && resumen.masVendidos.length > 0 && (
        <section className="px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Más vendidos
          </h2>
          <div className="flex flex-col gap-2">
            {resumen.masVendidos.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-600 text-xs w-4 shrink-0">{i + 1}.</span>
                  <span className="text-slate-300 truncate">{p.nombre}</span>
                </div>
                <span className="text-slate-500 text-xs tabular-nums shrink-0">{p.piezas} uds</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bloque 4: estado del corte */}
      {corte && (
        <section className="px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Estado del corte
          </h2>

          {corte.situacion === 'SIN_CAJA' && (
            <p className="text-sm text-slate-400">No hay caja abierta.</p>
          )}

          {corte.situacion === 'ABIERTA' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 rounded-xl bg-slate-800/60 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Fondo</p>
                <p className="text-lg font-black text-white tabular-nums truncate">{formatCurrency(corte.fondo ?? 0)}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-slate-800/60 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Debería haber</p>
                {corte.deberiaHaber !== undefined ? (
                  <p className="text-lg font-black text-emerald-400 tabular-nums truncate">
                    {formatCurrency(corte.deberiaHaber)}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-amber-400 leading-snug">
                    Falta la venta del día
                  </p>
                )}
              </div>
            </div>
          )}

          {corte.situacion === 'CERRADA' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0 rounded-xl bg-slate-800/60 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Fondo</p>
                <p className="text-sm font-black text-white tabular-nums truncate">{formatCurrency(corte.fondo ?? 0)}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-slate-800/60 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Contado</p>
                <p className="text-sm font-black text-white tabular-nums truncate">{formatCurrency(corte.contado ?? 0)}</p>
              </div>
              <div
                className={`min-w-0 rounded-xl p-3 ${
                  corte.diferencia !== 0
                    ? 'bg-rose-500/15 border border-rose-500/40'
                    : 'bg-slate-800/60'
                }`}
              >
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Diferencia</p>
                <p
                  className={`text-sm font-black tabular-nums truncate ${
                    corte.diferencia !== 0 ? 'text-rose-400' : 'text-white'
                  }`}
                >
                  {formatCurrency(corte.diferencia ?? 0)}
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
