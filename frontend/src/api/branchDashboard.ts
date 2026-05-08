import client from './client'
import type { BranchDashboard } from '../types/branchDashboard'

export async function getBranchDashboard(): Promise<BranchDashboard> {
  const { data } = await client.get<BranchDashboard>('/branch/dashboard')
  return data
}

export interface CloseGuidedPayload {
  counted_cash: number
  cash_total_per_method: Record<string, number>
  day_expenses_total: number
  notes?: string
}

export async function closeShiftGuided(sessionId: number, payload: CloseGuidedPayload) {
  const { data } = await client.post(`/cash/sessions/${sessionId}/close-guided`, payload)
  return data
}
