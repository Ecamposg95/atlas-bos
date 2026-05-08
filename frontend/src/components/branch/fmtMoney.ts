const _fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export function fmtMoney(s: string | null | undefined): string {
  return s == null ? '—' : _fmt.format(Number(s))
}
