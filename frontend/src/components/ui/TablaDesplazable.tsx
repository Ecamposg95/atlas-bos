/**
 * Contenedor de una tabla ancha. El scroll horizontal vive aquí para que el
 * cuerpo de la página nunca se desplace de lado en un teléfono.
 */
export function TablaDesplazable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">{children}</div>
}
