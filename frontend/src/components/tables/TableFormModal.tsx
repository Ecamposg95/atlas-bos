import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'

interface Props {
  open: boolean
  mode: 'area' | 'table'
  onClose: () => void
  onSubmitArea: (name: string) => Promise<void>
  onSubmitTable: (code: string, seats: number) => Promise<void>
}

export function TableFormModal({ open, mode, onClose, onSubmitArea, onSubmitTable }: Props) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [seats, setSeats] = useState(4)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setName(''); setCode(''); setSeats(4) }
  }, [open, mode])

  if (!open) return null

  const submit = async () => {
    setBusy(true)
    try {
      if (mode === 'area') { if (!name.trim()) return; await onSubmitArea(name.trim()) }
      else { if (!code.trim()) return; await onSubmitTable(code.trim(), seats) }
      onClose()
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
         onClick={onClose}>
      <div className="dax-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-white mb-4">
          {mode === 'area' ? 'Nueva área' : 'Nueva mesa'}
        </h3>
        {mode === 'area' ? (
          <label className="block text-sm text-slate-300 mb-4">
            Nombre del área
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Salón, Terraza, Barra…"
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" />
          </label>
        ) : (
          <>
            <label className="block text-sm text-slate-300 mb-3">
              Código de la mesa
              <input autoFocus value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="M1, T4, Barra-2…"
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" />
            </label>
            <label className="block text-sm text-slate-300 mb-4">
              Asientos
              <input type="number" min={1} value={seats}
                onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" />
            </label>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Crear</Button>
        </div>
      </div>
    </div>
  )
}
