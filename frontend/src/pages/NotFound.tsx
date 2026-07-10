import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
      <i className="fa-solid fa-circle-exclamation text-slate-600 text-6xl mb-6" />
      <h2 className="text-2xl font-black text-white mb-2">Página no encontrada</h2>
      <p className="text-slate-400 mb-6">La ruta que buscas no existe o está en construcción.</p>
      <Link to="/" className="dax-btn-primary">
        <i className="fa-solid fa-house" />
        Ir al inicio
      </Link>
    </div>
  )
}
