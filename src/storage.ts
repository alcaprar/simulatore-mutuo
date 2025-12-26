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
   * Run migrations on startup to ensure data consistency
   */
  static runMigrations(): void {
    const data = this.loadAppData();
    let needsSave = false;

    // Migration: Copy tabId to mortgage.id if not already set
    Object.entries(data.mortgages).forEach(([tabId, tabData]) => {
      if (tabData.mortgage && !tabData.mortgage.id) {
        tabData.mortgage.id = tabId;
        needsSave = true;
      }
    });

    // Migration: Ensure virtual mortgages use tabId as their identifier
    Object.entries(data.virtualMortgages).forEach(([tabId, virtualData]) => {
      if (!virtualData.id) {
        virtualData.id = tabId;
        needsSave = true;
      }
    });

    if (needsSave) {
      this.saveAppData(data);
      console.log('Storage migrations completed');
    }
  }

  /**
   * Save mortgage data for a specific id
   */
  static saveMortgage(id: string, mortgage: MortgageData): void {
    const data: TabData = { tabId: id, mortgage };
    const appData = this.loadAppData();
    appData.mortgages[id] = data;
    this.saveAppData(appData);
  }

  /**
   * Get mortgage data for a specific id
   */
  static getMortgage(id: string): MortgageData | null {
    const appData = this.loadAppData();
    const stored = appData.mortgages[id];
    if (!stored) return null;
    return stored.mortgage || null;
  }

  /**
   * Delete mortgage data for a specific id
   */
  static deleteMortgage(id: string): void {
    const appData = this.loadAppData();
    delete appData.mortgages[id];
    this.saveAppData(appData);
  }

  /**
   * Create a new mortgage with calculated amortization
   */
  static createMortgage(id: string, nome: string, input: MortgageInput) {
    const amortization = MortgageCalculator.generateAmortization(input);

    const mortgage: MortgageData = {
      id,
      nome,
      input,
      amortization,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.saveMortgage(id, mortgage);
    return mortgage;
  }

  /**
   * Update an existing mortgage
   */
  static updateMortgage(id: string, nome: string, input: MortgageInput) {
    const existing = this.getMortgage(id);
    const amortization = MortgageCalculator.generateAmortization(input);

    const mortgage: MortgageData = {
      id,
      nome,
      input,
      amortization,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    this.saveMortgage(id, mortgage);
    return mortgage;
  }

  /**
   * Create a new virtual mortgage
   */
  static createVirtualMortgage(
    id: string,
    nome: string,
    sourceIds: string[]
  ): VirtualMortgageData {
    const virtual: VirtualMortgageData = {
      id,
      nome,
      sourceIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const appData = this.loadAppData();
    appData.virtualMortgages[id] = virtual;
    this.saveAppData(appData);

    return virtual;
  }

  /**
   * Get virtual mortgage for a specific id
   */
  static getVirtualMortgage(id: string): VirtualMortgageData | null {
    const appData = this.loadAppData();
    return appData.virtualMortgages[id] || null;
  }

  /**
   * Delete virtual mortgage for a specific id
   */
  static deleteVirtualMortgage(id: string): void {
    const appData = this.loadAppData();
    delete appData.virtualMortgages[id];
    this.saveAppData(appData);
  }

  /**
   * Check if a mortgage is referenced by any virtual mortgage
   */
  static isReferencedByVirtual(mortgageId: string): boolean {
    return this.getVirtualsReferencingMortgage(mortgageId).length > 0;
  }

  /**
   * Get all virtual mortgages that reference a specific mortgage
   */
  static getVirtualsReferencingMortgage(mortgageId: string): VirtualMortgageData[] {
    const appData = this.loadAppData();
    return Object.values(appData.virtualMortgages).filter((virtual) =>
      virtual.sourceIds.includes(mortgageId)
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
   * Returns mapping of mortgage names to new IDs for virtual mortgage remapping
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
        // Check if a mortgage with this name already exists
        let id: string | undefined;
        for (const [mortgageId, tabData] of Object.entries(data.mortgages)) {
          if (tabData.mortgage?.nome === sharedMortgage.nome) {
            id = mortgageId;
            break;
          }
        }

        // If not found, generate a new ID
        if (!id) {
          id = this.generateUniqueTabId(sharedMortgage.nome, data);
        }

        // Calculate amortization from input
        const amortization = MortgageCalculator.generateAmortization(sharedMortgage.input);

        // Create mortgage data
        const mortgage: MortgageData = {
          id,
          nome: sharedMortgage.nome,
          input: sharedMortgage.input,
          amortization,
          createdAt: data.mortgages[id]?.mortgage?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        // Store (overwrites if exists)
        const tabData: TabData = { tabId: id, mortgage };
        data.mortgages[id] = tabData;
        mortgageTabIds.set(sharedMortgage.nome, id); // For virtual mapping
      });
    }

    // Import virtual mortgages (after regular mortgages)
    if (shareData.virtualMortgages) {
      shareData.virtualMortgages.forEach((sharedVirtual) => {
        // Remap sourceIds from shared names to actual IDs
        const remappedSourceIds = sharedVirtual.sourceIds
          .map((name) => mortgageTabIds.get(name))
          .filter((id) => id !== undefined) as string[];

        if (remappedSourceIds.length === 0) {
          console.warn('Virtual mortgage has no valid sources, skipping');
          return;
        }

        // Check if a virtual mortgage with this name already exists
        let id: string | undefined;
        for (const [virtualId, vMortgage] of Object.entries(data.virtualMortgages)) {
          if (vMortgage.nome === sharedVirtual.nome) {
            id = virtualId;
            break;
          }
        }

        // If not found, generate a new ID
        if (!id) {
          id = this.generateUniqueTabId(sharedVirtual.nome, data);
        }

        const virtualMortgage: VirtualMortgageData = {
          id,
          nome: sharedVirtual.nome,
          sourceIds: remappedSourceIds,
          createdAt: data.virtualMortgages[id]?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        // Store by ID
        data.virtualMortgages[id] = virtualMortgage;
        virtualTabIds.push(id);
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

  /**
   * Compute tabs from stored mortgages and virtual mortgages
   * Returns array of AppTab objects for UI rendering
   */
  static computeTabs(): Array<{
    id: string;
    name: string;
    isFixed: boolean;
    isVirtual?: boolean;
  }> {
    const data = this.loadAppData();
    const tabs: Array<{
      id: string;
      name: string;
      isFixed: boolean;
      isVirtual?: boolean;
    }> = [];

    // Add regular mortgage tabs
    Object.entries(data.mortgages).forEach(([tabId, tabData]) => {
      if (tabData.mortgage) {
        tabs.push({
          id: tabId,
          name: tabData.mortgage.nome,
          isFixed: false,
          isVirtual: false,
        });
      }
    });

    // Add virtual mortgage tabs
    Object.entries(data.virtualMortgages).forEach(([tabId, virtualData]) => {
      tabs.push({
        id: tabId,
        name: virtualData.nome,
        isFixed: false,
        isVirtual: true,
      });
    });

    return tabs;
  }

  /**
   * Get all tab IDs (mortgage and virtual tabs)
   */
  static getAllTabIds(): string[] {
    const data = this.loadAppData();
    return [...Object.keys(data.mortgages), ...Object.keys(data.virtualMortgages)];
  }
}
