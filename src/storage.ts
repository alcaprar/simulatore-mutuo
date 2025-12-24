import type { MortgageData, TabData, MortgageInput } from './types.js';
import { MortgageCalculator } from './utils/mortgage-calculator.js';

interface AppStorageData {
  mortgages: Record<string, TabData>;
}

export class StorageService {
  private static readonly APP_NAMESPACE = 'simulatore-mutuo';

  /**
   * Save mortgage data for a specific tab
   */
  static saveMortgage(tabId: string, mortgage: MortgageData): void {
    const data: TabData = { tabId, mortgage };
    const appData = this.loadAppData();
    appData.mortgages[tabId] = data;
    this.saveAppData(appData);
  }

  /**
   * Get mortgage data for a specific tab
   */
  static getMortgage(tabId: string): MortgageData | null {
    const appData = this.loadAppData();
    const stored = appData.mortgages[tabId];
    if (!stored) return null;
    return stored.mortgage || null;
  }

  /**
   * Delete mortgage data for a specific tab
   */
  static deleteMortgage(tabId: string): void {
    const appData = this.loadAppData();
    delete appData.mortgages[tabId];
    this.saveAppData(appData);
  }

  /**
   * Create a new mortgage with calculated amortization
   */
  static createMortgage(tabId: string, nome: string, input: MortgageInput) {
    const amortization = MortgageCalculator.generateAmortization(input);

    const mortgage: MortgageData = {
      id: `mortgage-${Date.now()}`,
      nome,
      input,
      amortization,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.saveMortgage(tabId, mortgage);
    return mortgage;
  }

  /**
   * Update an existing mortgage
   */
  static updateMortgage(tabId: string, nome: string, input: MortgageInput) {
    const existing = this.getMortgage(tabId);
    const amortization = MortgageCalculator.generateAmortization(input);

    const mortgage: MortgageData = {
      id: existing?.id || `mortgage-${Date.now()}`,
      nome,
      input,
      amortization,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    this.saveMortgage(tabId, mortgage);
    return mortgage;
  }

  /**
   * Load all app data from localStorage
   */
  private static loadAppData(): AppStorageData {
    const stored = localStorage.getItem(this.APP_NAMESPACE);
    if (!stored) {
      return { mortgages: {} };
    }

    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load app data from storage:', e);
      return { mortgages: {} };
    }
  }

  /**
   * Save all app data to localStorage
   */
  private static saveAppData(data: AppStorageData): void {
    localStorage.setItem(this.APP_NAMESPACE, JSON.stringify(data));
  }
}
