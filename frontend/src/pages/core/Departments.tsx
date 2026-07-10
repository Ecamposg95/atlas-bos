import { useEffect, useState, useCallback } from 'react'
import { productsApi } from '../../api/products'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import type { Department } from '../../types/products'

interface DeptForm { name: string }
const EMPTY: DeptForm = { name: '' }

export function Departments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState<DeptForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setDepartments(await productsApi.getDepartments()) }
    catch { setDepartments([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal('create') }
  const openEdit = (d: Department) => {
    setForm({ name: d.name })
    setEditing(d); setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      if (modal === 'create') await productsApi.createDepartment({ name: form.name })
      else if (editing) await productsApi.updateDepartment(editing.id, { name: form.name })
      setModal(null); load()
    } catch { alert('Error al guardar') } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar departamento?')) return
    try { await productsApi.deleteDepartment(id); load() }
    catch { alert('Error al eliminar') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-layer-group text-indigo-400 text-xl" />
          <h1 className="text-2xl font-black text-dax-text">Departamentos</h1>
        </div>
        <button onClick={openCreate} className="dax-btn-primary text-xs">
          <i className="fa-solid fa-plus" /> Nuevo
        </button>
      </div>

      <DaxCard padding={false}>
        {loading ? <Spinner text="Cargando..." /> : departments.length === 0 ? (
          <div className="p-12 text-center text-dax-faint">Sin departamentos</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dax-table w-full">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold text-dax-text">{d.name}</td>
                    <td className="flex gap-2">
                      <button onClick={() => openEdit(d)} className="text-dax-muted hover:text-dax-text text-xs"><i className="fa-solid fa-pen" /></button>
                      <button onClick={() => handleDelete(d.id)} className="text-dax-faint hover:text-sem-critical text-xs"><i className="fa-solid fa-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DaxCard>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="dax-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-dax-text">{modal === 'create' ? 'Nuevo Departamento' : 'Editar Departamento'}</h3>
              <button onClick={() => setModal(null)} className="text-dax-muted hover:text-dax-text"><i className="fa-solid fa-xmark text-lg" /></button>
            </div>
            <div>
              <label className="dax-label">Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ name: e.target.value })}
                className="dax-input w-full" placeholder="Ej: Electrónicos" autoFocus />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="dax-btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name} className="dax-btn-primary flex-1 justify-center disabled:opacity-40">
                {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
