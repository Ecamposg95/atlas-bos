import { useCallback, useEffect, useState } from 'react'
import { reportsApi } from '../../api/reports'
import { cashApi } from '../../api/cash'
import { organizationApi } from '../../api/organization'
import { useAuthStore } from '../../store/authStore'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../utils/currency'
import { todayStr } from '../../utils/dates'
import {
  resumirDia,
  barrasPorHora,
  estadoDelCorte,
  ambitoDelPanel,
  type ResumenDia,
  type BarraHora,
  type EstadoCorte,
  type AmbitoPanel,
  type SucursalMinima,
} from '../../utils/panelDia'

/**
 * Panel del dueño en móvil: cómo va el día, ritmo por hora, más vendidos y el
 * estado del corte. Si una fuente falla, las demás se muestran igual y el panel
 * dice qué no pudo cargar.
 *
 * El ámbito se resuelve primero (`ambitoDelPanel`) porque decide dos cosas: qué
 * `branch_id` mandan los reportes —un rol de oficina central mira toda la
 * organización, no la sucursal donde está anclado— y de qué sucursales se pide
 * el corte, que `/cash/branch-summary` entrega de una en una.
 */
export function MobileOwnerDashboard() {
  const org = useAuthStore((s) => s.org)
  const user = useAuthStore((s) => s.user)
  const [ambito, setAmbito] = useState<AmbitoPanel | null>(null)
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [barras, setBarras] = useState<BarraHora[] | null>(null)
  const [cortes, setCortes] = useState<EstadoCorte[] | null>(null)
  const [fallas, setFallas] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)

  const rol = user?.role
  const sucursalDelUsuario = user?.branch_id

  const cargar = useCallback(async () => {
    setCargando(true)
    setFallas([])
    const hoy = todayStr()
    const fallidas: string[] = []

    // Sin la lista de sucursales el panel no sabe de qué habla; con la lista
    // caída sigue adelante con el ámbito degradado, que al menos rotula
    // "Toda la organización" en vez de mentir con un nombre.
    let sucursales: SucursalMinima[] = []
    try {
      sucursales = await organizationApi.getBranches()
    } catch {
      fallidas.push('las sucursales')
    }
    const alcance = ambitoDelPanel(rol, sucursalDelUsuario, sucursales)
    setAmbito(alcance)

    const [rs, rh, ...rc] = await Promise.allSettled([
      reportsApi.dailySummary(hoy, alcance.branchId),
      reportsApi.salesByHour({ date: hoy, branch_id: alcance.branchId }),
      ...alcance.sucursalesDelCorte.map((id) => cashApi.branchSummary(id, hoy)),
    ])

    // Cada bloque se limpia si su fuente falló: dejar la cifra de la carga
    // anterior haría que el panel se contradiga a sí mismo tras un reintento.
    setResumen(rs.status === 'fulfilled' ? resumirDia(rs.value) : null)
    if (rs.status !== 'fulfilled') fallidas.push('la venta del día')

    setBarras(rh.status === 'fulfilled' ? barrasPorHora(rh.value) : null)
    if (rh.status !== 'fulfilled') fallidas.push('el ritmo por hora')

    const logrados = rc.filter((r) => r.status === 'fulfilled')
    setCortes(logrados.map((r) => estadoDelCorte(r.value)))
    if (logrados.length < rc.length) fallidas.push('el corte de caja')

    setFallas(fallidas)
    setCargando(false)
  }, [rol, sucursalDelUsuario])

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
        {ambito && (
          <p className="text-xs text-slate-500 truncate">{ambito.etiqueta}</p>
        )}
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

      {/* Bloque 4: estado del corte, una tarjeta por sucursal */}
      {cortes && (
        <section className="px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Estado del corte
          </h2>

          {cortes.length === 0 ? (
            <p className="text-sm text-slate-400">
              No hay ninguna sucursal con caja para mostrar.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {cortes.map((c, i) => (
                <div key={i} className="min-w-0 rounded-xl bg-slate-800/60 p-3">
                  <p className="text-xs font-bold text-slate-300 truncate mb-2">{c.sucursal}</p>

                  {c.sinCortes && (
                    <p className="text-sm text-slate-400">Nadie abrió caja hoy.</p>
                  )}

                  {c.abiertas > 0 && (
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                        Debería haber
                        {c.abiertas > 1 && ` · ${c.abiertas} turnos abiertos`}
                      </p>
                      <p className="text-lg font-black text-emerald-400 tabular-nums truncate">
                        {formatCurrency(c.deberiaHaber ?? 0)}
                      </p>
                    </div>
                  )}

                  {c.cerradas > 0 && (
                    <div className={`grid grid-cols-3 gap-2 ${c.abiertas > 0 ? 'mt-3 pt-3 border-t border-slate-700/60' : ''}`}>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Contado</p>
                        <p className="text-sm font-black text-white tabular-nums truncate">{formatCurrency(c.contado ?? 0)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Esperado</p>
                        <p className="text-sm font-black text-white tabular-nums truncate">{formatCurrency(c.esperadoCerrado ?? 0)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Diferencia</p>
                        <p
                          className={`text-sm font-black tabular-nums truncate ${
                            c.diferencia !== 0 ? 'text-rose-400' : 'text-white'
                          }`}
                        >
                          {formatCurrency(c.diferencia ?? 0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
