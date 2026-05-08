import client from './client'

export interface LinkedAccount {
  organization_id: number
  organization_name: string
  customer_id: number
  current_balance: number
  currency: string
}

export interface CustomerBalance {
  customer_id: number
  current_balance: number
  last_updated: string
}

export interface PortalQuote {
  id: string
  date: string
  total: number
  status: string
  organization_name: string
  items_count: number
}

export interface AccountTransaction {
  id: number
  transaction_type: string
  amount: number
  description: string | null
  reference: string | null
  created_at: string
  balance_after: number
}

export const portalApi = {
  getAccounts: async (): Promise<LinkedAccount[]> => {
    const { data } = await client.get<LinkedAccount[]>('/portal/accounts')
    return data
  },

  getBalance: async (): Promise<CustomerBalance> => {
    const { data } = await client.get<CustomerBalance>('/portal/my-account/balance')
    return data
  },

  getQuotes: async (): Promise<PortalQuote[]> => {
    const { data } = await client.get<PortalQuote[]>('/portal/quotes')
    return data
  },

  getTransactions: async (): Promise<AccountTransaction[]> => {
    const { data } = await client.get<AccountTransaction[]>('/portal/my-account/transactions')
    return data
  },
}
