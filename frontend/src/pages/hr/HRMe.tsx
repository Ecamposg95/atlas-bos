import { useEffect, useState } from 'react'
import { hrApi, type Employee, employeeFullName } from '../../api/hr'
import { DaxCard } from '../../components/ui/DaxCard'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { toast } from '../../store/toastStore'

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-slate-200">{value || <span className="text-slate-600 italic">No registrado</span>}</p>
    </div>
  )
}

function EditableField({
  label, name, value, onChange, type = 'text',
}: { label: string; name: string; value: string; onChange: (n: string, v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="dax-input"
      />
    </div>
  )
}

export function HRMe() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState<Partial<Employee>>({})

  useEffect(() => {
    hrApi.getMe()
      .then((emp) => { setEmployee(emp); setForm(emp) })
      .catch(() => setError('No se encontró tu expediente.'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (name: string, value: string) => {
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSuccess(false)
    try {
      const updated = await hrApi.updateMe(form)
      setEmployee(updated)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      toast.error('Error al guardar tus datos. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner text="Cargando expediente..." />
  if (error && !employee) return (
    <div className="dax-card p-8 text-center">
      <i className="fa-solid fa-circle-exclamation text-red-400 text-3xl mb-3" />
      <p className="text-red-400">{error}</p>
    </div>
  )

  const fullName = employee ? employeeFullName(employee) : ''
  const initials = fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-id-card text-indigo-400 text-xl" />
        <h1 className="text-2xl font-black text-white">Mi Expediente</h1>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-emerald-400 text-sm">
          <i className="fa-solid fa-check-circle" /> Datos guardados correctamente.
        </div>
      )}

      <DaxCard>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-xl font-black text-white">{fullName || '—'}</p>
            <p className="text-slate-400 text-sm">{employee?.employee_type?.replace('_', ' ')}</p>
            <p className="text-slate-500 text-xs mt-0.5">
              <i className="fa-solid fa-store mr-1" />Sin sucursal asignada
            </p>
          </div>
        </div>
        {employee?.hire_date && (
          <p className="text-slate-500 text-xs mt-3">
            <i className="fa-solid fa-calendar mr-1" />
            Ingreso: {new Date(employee.hire_date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </DaxCard>

      <DaxCard>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          <i className="fa-solid fa-fingerprint mr-2" />Identificación Oficial
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="CURP" value={employee?.curp} />
          <Field label="RFC" value={employee?.rfc} />
          <Field label="NSS" value={employee?.nss} />
        </div>
      </DaxCard>

      <DaxCard>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          <i className="fa-solid fa-user mr-2" />Información Personal
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableField label="Teléfono personal" name="phone" value={form.phone ?? ''} onChange={handleChange} type="tel" />
          <EditableField label="Correo personal" name="email_personal" value={form.email_personal ?? ''} onChange={handleChange} type="email" />
          <EditableField label="Fecha de nacimiento" name="birth_date" value={form.birth_date ?? ''} onChange={handleChange} type="date" />
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Estado civil</label>
            <select value={form.civil_status ?? ''} onChange={(e) => handleChange('civil_status', e.target.value)} className="dax-input">
              <option value="">Selecciona...</option>
              <option value="SOLTERO">Soltero/a</option>
              <option value="CASADO">Casado/a</option>
              <option value="UNION_LIBRE">Unión libre</option>
              <option value="DIVORCIADO">Divorciado/a</option>
              <option value="VIUDO">Viudo/a</option>
            </select>
          </div>
        </div>
      </DaxCard>

      <DaxCard>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          <i className="fa-solid fa-house mr-2" />Domicilio Actual
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableField label="Calle y número" name="address_street" value={form.address_street ?? ''} onChange={handleChange} />
          <EditableField label="Ciudad / Municipio" name="address_city" value={form.address_city ?? ''} onChange={handleChange} />
          <EditableField label="Estado" name="address_state" value={form.address_state ?? ''} onChange={handleChange} />
          <EditableField label="Código Postal" name="address_zip" value={form.address_zip ?? ''} onChange={handleChange} />
        </div>
      </DaxCard>

      <DaxCard>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          <i className="fa-solid fa-phone-volume mr-2" />Contacto de Emergencia
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableField label="Nombre completo" name="emergency_contact_name" value={form.emergency_contact_name ?? ''} onChange={handleChange} />
          <EditableField label="Teléfono" name="emergency_contact_phone" value={form.emergency_contact_phone ?? ''} onChange={handleChange} type="tel" />
        </div>
      </DaxCard>

      <DaxCard>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          <i className="fa-solid fa-building-columns mr-2" />Datos Bancarios — Nómina
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableField label="Banco" name="bank_name" value={form.bank_name ?? ''} onChange={handleChange} />
          <EditableField label="No. Cuenta / CLABE" name="bank_account" value={form.bank_account ?? ''} onChange={handleChange} />
        </div>
      </DaxCard>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} icon="fa-save">Guardar cambios</Button>
      </div>
    </div>
  )
}
