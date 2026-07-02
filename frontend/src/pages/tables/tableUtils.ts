interface RawCartItem {
  quantity?: number
  price?: number
  subtotal?: number
}

function items(cartJson: unknown): RawCartItem[] {
  if (cartJson && typeof cartJson === 'object' && Array.isArray((cartJson as any).items)) {
    return (cartJson as any).items as RawCartItem[]
  }
  return []
}

/** Suma de subtotales de la cuenta. Usa `subtotal` si viene; si no, price*qty. */
export function ticketTotal(cartJson: unknown): number {
  return items(cartJson).reduce((sum, it) => {
    const line = it.subtotal ?? (it.price ?? 0) * (it.quantity ?? 0)
    return sum + (Number.isFinite(line) ? line : 0)
  }, 0)
}

/** Minutos que la mesa lleva abierta. `now` en ms (Date.now()). */
export function minutesOpen(openedAt: string | null, now: number): number {
  if (!openedAt) return 0
  const start = new Date(openedAt).getTime()
  if (!Number.isFinite(start)) return 0
  return Math.max(0, Math.floor((now - start) / 60000))
}

/** Número de ítems en la cuenta. */
export function cartItemCount(cartJson: unknown): number {
  return items(cartJson).reduce((n, it) => n + (it.quantity ?? 1), 0)
}
