import type { Product } from '../types/products'
import type { FireItem } from './kitchen'

export interface CartLine {
  product_id: string
  sku: string
  name: string
  price: number
  quantity: number
  discount: number
  subtotal: number
}

/** Platillo → ítem de comanda para KDS (description obligatorio). */
export function toFireItem(p: Product, qty: number): FireItem {
  const variantId = p.variants && p.variants.length ? p.variants[0].id : null
  return { description: p.name, qty, variant_id: variantId }
}

/** Platillo → línea de cuenta (cart_json.items) para cobrar luego en POS. */
export function toCartItem(p: Product, qty: number): CartLine {
  return {
    product_id: p.id,
    sku: p.sku,
    name: p.name,
    price: p.price,
    quantity: qty,
    discount: 0,
    subtotal: p.price * qty,
  }
}
