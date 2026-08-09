/**
 * Normaliza un teléfono para wa.me: solo dígitos, con lada de país.
 * Suposición MX: a 10 dígitos se antepone 52. Si ya trae 52/521 (12-13
 * dígitos) se respeta. Cualquier otra longitud no es marcable → null.
 */
export function toWaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `52${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return digits
  if (digits.length === 13 && digits.startsWith('521')) return digits
  return null
}
