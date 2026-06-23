import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { recipesApi } from '../../api/recipes'
import { Button } from '../../components/ui/Button'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { confirm } from '../../components/ui/ConfirmDialog'
import { toast } from '../../store/toastStore'
import type { Recipe } from '../../types/recipes'

export function Recipes() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRecipes(await recipesApi.list())
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al cargar recetas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (r: Recipe) => {
    const ok = await confirm({
      title: 'Eliminar receta',
      message: `¿Eliminar la receta "${r.name}"?`,
      variant: 'danger',
    })
    if (!ok) return
    setDeleting(r.id)
    try {
      await recipesApi.remove(r.id)
      setRecipes((prev) => prev.filter((x) => x.id !== r.id))
      toast.success('Receta eliminada')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo eliminar')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <Spinner size="lg" text="Cargando recetas..." />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-book text-orange-400 text-xl" />
          <h1 className="text-2xl font-black text-white">Recetas</h1>
        </div>
        <Button variant="primary" icon="fa-plus" onClick={() => navigate('/recipes/new')}>
          Nueva receta
        </Button>
      </div>

      {recipes.length === 0 ? (
        <DaxCard>
          <p className="text-slate-400">
            Aún no hay recetas. Crea una para costear tus platillos y descontar insumos
            automáticamente en cada venta.
          </p>
        </DaxCard>
      ) : (
        <div className="grid gap-3">
          {recipes.map((r) => (
            <DaxCard key={r.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{r.name}</p>
                  <p className="text-sm text-slate-400">
                    Rinde {Number(r.yield_qty)} · {r.ingredients.length} insumo(s)
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" icon="fa-pen" onClick={() => navigate(`/recipes/${r.id}/edit`)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost" size="sm" icon="fa-trash"
                    loading={deleting === r.id}
                    onClick={() => handleDelete(r)}
                  >
                    Borrar
                  </Button>
                </div>
              </div>
            </DaxCard>
          ))}
        </div>
      )}
    </div>
  )
}
