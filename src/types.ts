export interface MortgageInput {
  importoTotale: number
  mesePartenza: number // 0-11 (0 = January)
  annoPartenza: number
  durataAnni: number
  tassoInteresse: number // annual percentage
  speseIstruttoria: {
    tipo: 'percentage' | 'fixed'
    valore: number
  }
  speseIncassoRata: number // per month
  spesaPerizia: number
  risparmiMensiliForecast?: number // monthly savings for early closure
  detrazioneRistrutturazione?: number // renovation deduction amount
  detrazioniInteressi?: boolean // whether to include interest deductions in early closure calculation
}

export interface AmortizationRow {
  periodo: number
  anno: number
  mese: number
  meseName: string
  quotaInteressi: number
  quotaCapitale: number
  totaleRataMensile: number
  totaleIntaressPagato: number
  totalePrincipalPagato: number
  capitaleRimanente: number
  risparmiAccumulati?: number
}

export interface MortgageData {
  id: string
  nome: string
  input: MortgageInput
  amortization: AmortizationRow[]
  createdAt: number
  updatedAt: number
}

export interface EarlyClosureData {
  isPossible: boolean
  meseChiusura?: number // month when closure is possible (1-based from start)
  annoChiusura?: number // year of closure
  risparmiAccumulati?: number // accumulated savings at closure
  capitalePagato?: number // remaining capital at that point
  mesiRisparmiati?: number // months saved compared to full plan
}

export interface AppTab {
  id: string
  name: string
  isFixed: boolean
}

export interface TabData {
  tabId: string
  mortgage?: MortgageData
}
