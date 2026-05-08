export const INDUSTRY_ICON_V2: Record<string, string> = {
  RETAIL: 'fa-bag-shopping',
  CLINIC: 'fa-stethoscope',
  ATLAS_POS: 'fa-cash-register',
  RESTAURANT: 'fa-utensils',
  FOOD: 'fa-utensils',
  WORKSHOP: 'fa-screwdriver-wrench',
  GYM: 'fa-dumbbell',
  BEAUTY: 'fa-scissors',
  SERVICES: 'fa-briefcase',
  OTHER: 'fa-building',
  UNKNOWN: 'fa-circle-question',
}

export function industryIconV2(industry?: string | null): string {
  if (!industry) return INDUSTRY_ICON_V2.UNKNOWN
  return INDUSTRY_ICON_V2[industry.toUpperCase()] ?? INDUSTRY_ICON_V2.OTHER
}
