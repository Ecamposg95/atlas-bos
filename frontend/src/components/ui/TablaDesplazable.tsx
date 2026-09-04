/**
 * Contenedor de una tabla ancha. El scroll horizontal vive aquí para que el
 * cuerpo de la página nunca se desplace de lado en un teléfono.
 *
 * Por la regla de interdependencia de `overflow` en CSS, declarar solo
 * `overflow-x: auto` ya convierte a este `div` en un contenedor de scroll
 * (su `overflow-y` se computa como `auto`, nunca queda en `visible`). Eso es
 * inofensivo mientras nadie dentro de la tabla dependa de ese eje — pero si
 * la tabla tiene un `<thead sticky>` y vive dentro de un panel con altura
 * acotada (p. ej. `max-h-64 overflow-y-auto`), el `sticky` se ancla al
 * contenedor de scroll más cercano. Si ese límite de altura se queda en el
 * `div` de afuera, el sticky se ancla a ESTE `div` (que no tiene altura
 * acotada ni scroll real) y el encabezado deja de fijarse: se va con las
 * filas al desplazar.
 *
 * La solución es que este mismo `div` sea el único contenedor de scroll de
 * ambos ejes: el llamador le pasa el límite de altura (y su propio
 * `overflow-y-auto`) por `className` en vez de ponerlo en un `div` aparte
 * por fuera. Así el `sticky` se ancla aquí, que sí es el contenedor que
 * realmente se desplaza verticalmente.
 */
export function TablaDesplazable({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}>{children}</div>
}
