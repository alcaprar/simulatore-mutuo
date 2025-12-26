import type { MortgageData, TabData, MortgageInput, VirtualMortgageData } from './types.js';
import { MortgageCalculator } from './utils/mortgage-calculator.js';
import type { ShareData } from './utils/url-share.js';

interface AppStorageData {
  mortgages: Record<string, TabData>;
  virtualMortgages: Record<string, VirtualMortgageData>;
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
   * Create a new virtual mortgage
   */
  static createVirtualMortgage(
    tabId: string,
    nome: string,
    sourceIds: string[]
  ): VirtualMortgageData {
    const virtual: VirtualMortgageData = {
      id: `virtual-${Date.now()}`,
      nome,
      sourceIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const appData = this.loadAppData();
    appData.virtualMortgages[tabId] = virtual;
    this.saveAppData(appData);

    return virtual;
  }

  /**
   * Get virtual mortgage for a specific tab
   */
  static getVirtualMortgage(tabId: string): VirtualMortgageData | null {
    const appData = this.loadAppData();
    return appData.virtualMortgages[tabId] || null;
  }

  /**
   * Delete virtual mortgage for a specific tab
   */
  static deleteVirtualMortgage(tabId: string): void {
    const appData = this.loadAppData();
    delete appData.virtualMortgages[tabId];
    this.saveAppData(appData);
  }

  /**
   * Check if a mortgage is referenced by any virtual mortgage
   */
  static isReferencedByVirtual(mortgageTabId: string): boolean {
    return this.getVirtualsReferencingMortgage(mortgageTabId).length > 0;
  }

  /**
   * Get all virtual mortgages that reference a specific mortgage
   */
  static getVirtualsReferencingMortgage(mortgageTabId: string): VirtualMortgageData[] {
    const appData = this.loadAppData();
    return Object.values(appData.virtualMortgages).filter((virtual) =>
      virtual.sourceIds.includes(mortgageTabId)
    );
  }

  /**
   * Get all source mortgages for a virtual
   */
  static getSourceMortgages(sourceIds: string[]): MortgageData[] {
    const mortgages: MortgageData[] = [];
    for (const sourceId of sourceIds) {
      const mortgage = this.getMortgage(sourceId);
      if (mortgage) {
        mortgages.push(mortgage);
      }
    }
    return mortgages;
  }

  /**
   * Load all app data from localStorage
   */
  private static loadAppData(): AppStorageData {
    const stored = localStorage.getItem(this.APP_NAMESPACE);
    if (!stored) {
      return { mortgages: {}, virtualMortgages: {} };
    }

    try {
      const data = JSON.parse(stored);
      // Ensure virtualMortgages exists (for backwards compatibility)
      if (!data.virtualMortgages) {
        data.virtualMortgages = {};
      }
      return data;
    } catch (e) {
      console.error('Failed to load app data from storage:', e);
      return { mortgages: {}, virtualMortgages: {} };
    }
  }

  /**
   * Save all app data to localStorage
   */
  private static saveAppData(data: AppStorageData): void {
    localStorage.setItem(this.APP_NAMESPACE, JSON.stringify(data));
  }

  /**
   * Import shared mortgage data, generating new IDs to avoid conflicts
   * Returns mapping of mortgage names to new tab IDs for virtual mortgage remapping
   */
  static importSharedData(shareData: ShareData): {
    mortgageTabIds: Map<string, string>;
    virtualTabIds: string[];
  } {
    const data = this.loadAppData();
    const mortgageTabIds = new Map<string, string>();
    const virtualTabIds: string[] = [];

    // Import regular mortgages
    if (shareData.mortgages) {
      shareData.mortgages.forEach((sharedMortgage) => {
        // Generate new IDs
        const mortgageId = `mortgage-${Date.now() + Math.random()}`;
        const tabId = this.generateUniqueTabId(sharedMortgage.nome, data);

        // Calculate amortization from input
        const amortization = MortgageCalculator.generateAmortization(sharedMortgage.input);

        // Create mortgage data
        const mortgage: MortgageData = {
          id: mortgageId,
          nome: sharedMortgage.nome,
          input: sharedMortgage.input,
          amortization,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Store
        const tabData: TabData = { tabId, mortgage };
        data.mortgages[tabId] = tabData;
        mortgageTabIds.set(sharedMortgage.nome, tabId); // For virtual mapping
      });
    }

    // Import virtual mortgages (after regular mortgages)
    if (shareData.virtualMortgages) {
      shareData.virtualMortgages.forEach((sharedVirtual) => {
        // Remap sourceIds from shared names to actual tabIds
        const remappedSourceIds = sharedVirtual.sourceIds
          .map((name) => mortgageTabIds.get(name))
          .filter((id) => id !== undefined) as string[];

        if (remappedSourceIds.length === 0) {
          console.warn('Virtual mortgage has no valid sources, skipping');
          return;
        }

        const virtualId = `virtual-${Date.now() + Math.random()}`;
        const tabId = this.generateUniqueTabId(sharedVirtual.nome, data);

        const virtualMortgage: VirtualMortgageData = {
          id: virtualId,
          nome: sharedVirtual.nome,
          sourceIds: remappedSourceIds,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        data.virtualMortgages[virtualId] = virtualMortgage;
        virtualTabIds.push(tabId);
      });
    }

    this.saveAppData(data);
    return { mortgageTabIds, virtualTabIds };
  }

  /**
   * Generate unique tab ID, avoiding conflicts
   */
  private static generateUniqueTabId(name: string, data: AppStorageData): string {
    // Use same logic as app.ts generateTabId
    const baseId = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    let tabId = baseId;
    let counter = 1;

    while (data.mortgages[tabId] || data.virtualMortgages[tabId]) {
      tabId = `${baseId}-${counter}`;
      counter++;
    }

    return tabId;
  }
}
