import { useEffect, useState } from 'react'
import { hrApi, type Employee, employeeFullName } from '../../api/hr'
import { useAuthStore } from '../../store/authStore'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { toast } from '../../store/toastStore'

const EMPLOYEE_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Tiempo completo',
  PART_TIME: 'Medio tiempo',
  CONTRACTOR: 'Contratista',
  INTERN: 'Practicante',
}

export function MobileProfile() {
  const { user } = useAuthStore()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ phone: '', email_personal: '' })
  const [noProfile, setNoProfile] = useState(false)

  useEffect(() => {
    hrApi.getMe()
      .then((emp) => {
        setEmployee(emp)
        setForm({ phone: emp.phone ?? '', email_personal: emp.email_personal ?? '' })
      })
      .catch(() => setNoProfile(true))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!employee) return
    setSaving(true)
    try {
      const updated = await hrApi.updateMe({
        phone: form.phone || null,
        email_personal: form.email_personal || null,
      })
      setEmployee(updated)
      setForm({ phone: updated.phone ?? '', email_personal: updated.email_personal ?? '' })
      setEditing(false)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' && detail.trim() ? detail : 'No se pudieron guardar los cambios del perfil')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-user-circle text-indigo-400 text-xl" />
        <h1 className="text-2xl font-black text-white">Mi Perfil</h1>
      </div>

      {/* Info de cuenta */}
      <DaxCard>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-indigo-600/20 border border-indigo-500/30 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-user text-indigo-400 text-xl" />
          </div>
          <div>
            <p className="text-white font-black text-lg leading-tight">{user?.full_name ?? user?.username ?? '—'}</p>
            <p className="text-slate-500 text-sm">{user?.username}</p>
            <span className="inline-block mt-1 bg-indigo-600/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              {user?.role}
            </span>
          </div>
        </div>
      </DaxCard>

      {/* Datos de empleado */}
      {loading ? (
        <Spinner text="Cargando perfil..." />
      ) : noProfile ? (
        <DaxCard>
          <div className="py-6 text-center text-slate-500">
            <i className="fa-solid fa-id-card text-3xl mb-3 block text-slate-600" />
            <p className="font-medium">Sin expediente de empleado</p>
            <p className="text-xs mt-1 text-slate-600">Contacta a Recursos Humanos</p>
          </div>
        </DaxCard>
      ) : employee ? (
        <>
          <DaxCard>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Datos laborales</p>
              {!editing && (
                <button onClick={() => setEditing(true)} className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">
                  <i className="fa-solid fa-pen mr-1" />Editar
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="dax-label">Teléfono</label>
                  <input type="tel" value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="dax-input w-full" placeholder="+52 555 000 0000" />
                </div>
                <div>
                  <label className="dax-label">Email personal</label>
                  <input type="email" value={form.email_personal}
                    onChange={(e) => setForm((p) => ({ ...p, email_personal: e.target.value }))}
                    className="dax-input w-full" placeholder="correo@ejemplo.com" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditing(false)} className="dax-btn-secondary flex-1 text-xs">Cancelar</button>
                  <button onClick={handleSave} disabled={saving} className="dax-btn-primary flex-1 text-xs justify-center disabled:opacity-40">
                    {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" /> Guardar</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 text-sm">
                <InfoRow icon="fa-id-badge" label="Nombre" value={employeeFullName(employee)} />
                <InfoRow icon="fa-briefcase" label="Tipo" value={EMPLOYEE_TYPE_LABEL[employee.employee_type] ?? employee.employee_type} />
                {employee.hire_date && (
                  <InfoRow icon="fa-calendar-check" label="Ingreso" value={new Date(employee.hire_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} />
                )}
                <InfoRow icon="fa-phone" label="Teléfono" value={employee.phone ?? '—'} />
                <InfoRow icon="fa-envelope" label="Email personal" value={employee.email_personal ?? '—'} />
                {employee.is_active
                  ? <InfoRow icon="fa-circle-check" label="Estado" value="Activo" valueClass="text-emerald-400" />
                  : <InfoRow icon="fa-circle-xmark" label="Estado" value="Inactivo" valueClass="text-red-400" />
                }
              </div>
            )}
          </DaxCard>

          {/* Datos personales adicionales */}
          {(employee.curp || employee.rfc || employee.nss) && (
            <DaxCard>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Datos fiscales</p>
              <div className="space-y-2.5 text-sm">
                {employee.curp && <InfoRow icon="fa-fingerprint" label="CURP" value={employee.curp} />}
                {employee.rfc && <InfoRow icon="fa-receipt" label="RFC" value={employee.rfc} />}
                {employee.nss && <InfoRow icon="fa-id-card" label="NSS" value={employee.nss} />}
              </div>
            </DaxCard>
          )}
        </>
      ) : null}
    </div>
  )
}

function InfoRow({ icon, label, value, valueClass }: { icon: string; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3">
      <i className={`fa-solid ${icon} text-slate-600 w-4 mt-0.5 flex-shrink-0`} />
      <span className="text-slate-500 w-28 flex-shrink-0">{label}</span>
      <span className={`font-medium ${valueClass ?? 'text-slate-300'} flex-1 min-w-0 break-words`}>{value}</span>
    </div>
  )
}
