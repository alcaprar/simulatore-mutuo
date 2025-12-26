export interface MortgageInput {
  importoTotale: number;
  mesePartenza: number; // 0-11 (0 = January)
  annoPartenza: number;
  durataAnni: number;
  tassoInteresse: number; // annual percentage
  speseIstruttoria: {
    tipo: 'percentage' | 'fixed';
    valore: number;
  };
  speseIncassoRata: number; // per month
  spesaPerizia: number;
  numeroPerizie?: number; // number of valuations/inspections (default: 1)
  assicurazioneIncendio?: {
    tipo: 'onetime' | 'monthly';
    valore: number;
  }; // insurance for fire/explosion (optional)
  assicurazioneAggiuntiva?: {
    tipo: 'onetime' | 'monthly';
    valore: number;
  }; // additional insurance (death, illness, job loss, etc.) (optional)
  risparmiMensiliForecast?: number; // monthly savings for early closure
  detrazioneRistrutturazione?: number; // renovation deduction amount
  detrazioniInteressi?: boolean; // whether to include interest deductions in early closure calculation
}

export interface AmortizationRow {
  periodo: number;
  anno: number;
  mese: number;
  meseName: string;
  quotaInteressi: number;
  quotaCapitale: number;
  totaleRataMensile: number;
  totaleIntaressPagato: number;
  totalePrincipalPagato: number;
  capitaleRimanente: number;
  risparmiAccumulati?: number;
  detrazioniAccumulate?: number; // accumulated deductions (renovation + interest)
}

export interface MortgageData {
  id: string;
  nome: string;
  input: MortgageInput;
  amortization: AmortizationRow[];
  createdAt: number;
  updatedAt: number;
}

export interface EarlyClosureData {
  isPossible: boolean;
  meseChiusura?: number; // month when closure is possible (1-based from start)
  annoChiusura?: number; // year of closure
  risparmiAccumulati?: number; // accumulated savings at closure
  capitalePagato?: number; // remaining capital at that point
  mesiRisparmiati?: number; // months saved compared to full plan
}

export interface MortgageBreakdown {
  mortgageId: string; // tab ID of source mortgage
  mortgageName: string; // name of source mortgage
  quotaInteressi: number;
  quotaCapitale: number;
  totaleRataMensile: number;
  isActive: boolean; // is this mortgage active in this period?
}

export interface VirtualAmortizationRow extends AmortizationRow {
  breakdown: MortgageBreakdown[]; // contribution from each source mortgage
  activeMortgageCount: number; // how many mortgages are active in this period
}

export interface VirtualMortgageData {
  id: string; // "virtual-{timestamp}"
  nome: string; // display name
  sourceIds: string[]; // array of tabIds to combine
  createdAt: number;
  updatedAt: number;
}

export interface AppTab {
  id: string;
  name: string;
  isFixed: boolean;
  isVirtual?: boolean; // true if this tab represents a virtual mortgage
}

export interface TabData {
  tabId: string;
  mortgage?: MortgageData;
  virtualMortgage?: VirtualMortgageData; // for virtual tabs
}
