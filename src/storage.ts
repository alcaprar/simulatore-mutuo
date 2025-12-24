import type { MortgageData, TabData } from './types.js'
import { MortgageCalculator } from './utils/mortgage-calculator.js'

export class StorageService {
  private static readonly TAB_DATA_PREFIX = 'mutuo-tab-'

  /**
   * Save mortgage data for a specific tab
   */
  static saveMortgage(tabId: string, mortgage: MortgageData): void {
    const key = this.getTabDataKey(tabId)
    const data: TabData = { tabId, mortgage }
    localStorage.setItem(key, JSON.stringify(data))
  }

  /**
   * Get mortgage data for a specific tab
   */
  static getMortgage(tabId: string): MortgageData | null {
    const key = this.getTabDataKey(tabId)
    const stored = localStorage.getItem(key)
    if (!stored) return null

    try {
      const data: TabData = JSON.parse(stored)
      return data.mortgage || null
    } catch (e) {
      console.error(`Failed to load mortgage data for tab ${tabId}:`, e)
      return null
    }
  }

  /**
   * Delete mortgage data for a specific tab
   */
  static deleteMortgage(tabId: string): void {
    const key = this.getTabDataKey(tabId)
    localStorage.removeItem(key)
  }

  /**
   * Create a new mortgage with calculated amortization
   */
  static createMortgage(tabId: string, nome: string, input: any) {
    const amortization = MortgageCalculator.generateAmortization(input)

    const mortgage: MortgageData = {
      id: `mortgage-${Date.now()}`,
      nome,
      input,
      amortization,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.saveMortgage(tabId, mortgage)
    return mortgage
  }

  /**
   * Update an existing mortgage
   */
  static updateMortgage(tabId: string, nome: string, input: any) {
    const existing = this.getMortgage(tabId)
    const amortization = MortgageCalculator.generateAmortization(input)

    const mortgage: MortgageData = {
      id: existing?.id || `mortgage-${Date.now()}`,
      nome,
      input,
      amortization,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    this.saveMortgage(tabId, mortgage)
    return mortgage
  }

  private static getTabDataKey(tabId: string): string {
    return `${this.TAB_DATA_PREFIX}${tabId}`
  }
}
