import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { AppTab, MortgageData } from './types.js';
import { StorageService } from './storage.js';
import { URLShareService } from './utils/url-share.js';
import './components/mortgage-tab.js';
import './components/virtual-mortgage-tab.js';
import './components/virtual-mortgage-selector.js';
import './components/mortgages-summary.js';

@customElement('mutuo-app')
export class MutuoApp extends LitElement {
  @state()
  private tabs: AppTab[] = [
    { id: 'impostazioni', name: 'Impostazioni', isFixed: true },
    { id: 'resoconto', name: 'Resoconto', isFixed: true },
  ];

  @state()
  private activeTabId: string = 'impostazioni';

  @state()
  private showAddTabDialog: boolean = false;

  @state()
  private newTabName: string = '';

  @state()
  private showDebug: boolean = false;

  @state()
  private showVirtualMortgageSelector: boolean = false;

  @state()
  private availableMortgagesForVirtual: Array<{ tabId: string; mortgage: MortgageData }> = [];

  private boundHandleRouteChange = () => this.handleRouteChange();

  connectedCallback() {
    super.connectedCallback();
    // Check for share parameter BEFORE loading tabs
    this.handleShareURL();
    this.loadTabsFromStorage();
    window.addEventListener('hashchange', this.boundHandleRouteChange);

    // Listen for tab changes from child components
    this.addEventListener('tabs-changed', () => {
      this.loadTabsFromStorage();
    });

    this.handleRouteChange();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.boundHandleRouteChange);
  }

  private loadTabsFromStorage(): void {
    // Fixed tabs are always present
    const fixedTabs = [
      { id: 'impostazioni', name: 'Impostazioni', isFixed: true },
      { id: 'resoconto', name: 'Resoconto', isFixed: true },
    ];

    // Compute custom tabs from mortgages
    const customTabs = StorageService.computeTabs();

    this.tabs = [...fixedTabs, ...customTabs];
  }

  private switchTab(tabId: string): void {
    window.location.hash = tabId;
  }

  private handleRouteChange(): void {
    const hash = window.location.hash.slice(1) || '';

    if (hash) {
      // Check if tab exists
      if (this.tabs.some((t) => t.id === hash)) {
        this.activeTabId = hash;
      } else {
        // Tab doesn't exist, go to resoconto (default)
        window.location.hash = 'resoconto';
      }
    } else {
      // No hash, set to resoconto (default)
      window.location.hash = 'resoconto';
    }
  }

  /**
   * Handle share URL parameter if present
   */
  private handleShareURL(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');

    if (!shareParam) return;

    try {
      const shareData = URLShareService.decode(shareParam);

      if (!shareData) {
        console.error('Invalid share data');
        alert('Link di condivisione non valido');
        this.clearShareParam();
        return;
      }

      // Import the data
      const { mortgageTabIds, virtualTabIds } = StorageService.importSharedData(shareData);

      // RELOAD TABS - this is the fix for the sharing bug!
      this.loadTabsFromStorage();

      // Notify user of successful import
      const mortgageCount = mortgageTabIds.size;
      const virtualCount = virtualTabIds.length;
      alert(`Importati ${mortgageCount} mutuo/i e ${virtualCount} mutuo/i virtuale/i`);

      // Redirect to first imported mortgage or resoconto
      const firstTabId = Array.from(mortgageTabIds.values())[0] || 'resoconto';

      // Clear share param and redirect
      this.clearShareParam();
      window.location.hash = firstTabId;
    } catch (e) {
      console.error('Failed to import shared data:', e);
      alert("Errore durante l'importazione dei dati");
      this.clearShareParam();
    }
  }

  /**
   * Clear share parameter from URL
   */
  private clearShareParam(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.toString());
  }

  private generateTabId(name: string): string {
    // Generate a slug from the name
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^\w-]/g, '') // Remove non-word characters except hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  private openAddTabDialog(): void {
    this.showAddTabDialog = true;
    this.newTabName = '';
  }

  private closeAddTabDialog(): void {
    this.showAddTabDialog = false;
    this.newTabName = '';
  }

  private addNewTab(): void {
    if (this.newTabName.trim()) {
      // Generate tab ID from name
      let newId = this.generateTabId(this.newTabName);

      // Ensure unique ID
      const existingIds = StorageService.getAllTabIds();
      let counter = 1;
      const baseId = newId;
      while (existingIds.includes(newId)) {
        newId = `${baseId}-${counter}`;
        counter++;
      }

      // Tab will be created automatically when mortgage is saved
      // Just switch to the new tab and show the form
      this.closeAddTabDialog();
      this.switchTab(newId);
    }
  }

  private deleteTab(tabId: string): void {
    const tabToDelete = this.tabs.find((t) => t.id === tabId);
    if (tabToDelete?.isFixed) {
      return; // Cannot delete fixed tabs
    }

    // Delete the underlying mortgage or virtual mortgage
    if (tabToDelete?.isVirtual) {
      StorageService.deleteVirtualMortgage(tabId);
    } else {
      StorageService.deleteMortgage(tabId);
    }

    // Reload tabs from storage
    this.loadTabsFromStorage();

    // Switch to another tab if the active tab was deleted
    if (this.activeTabId === tabId) {
      this.switchTab('resoconto');
    }
  }

  private openVirtualMortgageSelector(): void {
    // Load available mortgages (exclude fixed tabs and virtual tabs)
    const customTabIds = this.tabs.filter((t) => !t.isFixed && !t.isVirtual).map((t) => t.id);

    this.availableMortgagesForVirtual = customTabIds
      .map((tabId) => {
        const mortgage = StorageService.getMortgage(tabId);
        return mortgage ? { tabId, mortgage } : null;
      })
      .filter((item): item is { tabId: string; mortgage: MortgageData } => item !== null);

    this.showVirtualMortgageSelector = true;
  }

  private closeVirtualMortgageSelector(): void {
    this.showVirtualMortgageSelector = false;
    this.availableMortgagesForVirtual = [];
  }

  private addVirtualMortgage(event: CustomEvent<{ name: string; sourceIds: string[] }>): void {
    const { name, sourceIds } = event.detail;

    let newId = this.generateTabId(`virtual-${name}`);

    // Ensure unique ID
    let counter = 1;
    const baseId = newId;
    while (this.tabs.some((t) => t.id === newId)) {
      newId = `${baseId}-${counter}`;
      counter++;
    }

    // Create virtual mortgage in storage
    StorageService.createVirtualMortgage(newId, name, sourceIds);

    // Reload tabs to include the newly created virtual mortgage
    this.loadTabsFromStorage();

    this.closeVirtualMortgageSelector();
    this.switchTab(newId);
  }

  private handleDeleteVirtualTab(event: CustomEvent<{ tabId: string }>): void {
    const { tabId } = event.detail;
    this.deleteTab(tabId);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.addNewTab();
    } else if (event.key === 'Escape') {
      this.closeAddTabDialog();
    }
  }

  private getLocalStorageData(): Record<string, unknown> {
    const stored = localStorage.getItem('simulatore-mutuo');
    if (!stored) {
      return {};
    }

    try {
      return JSON.parse(stored);
    } catch {
      return { raw: stored };
    }
  }

  private clearAllLocalStorage(): void {
    if (confirm('Are you sure you want to clear all app data? This cannot be undone.')) {
      localStorage.removeItem('simulatore-mutuo');
      // Reload to reset the app
      window.location.reload();
    }
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  }

  render() {
    const activeTab = this.tabs.find((t) => t.id === this.activeTabId);

    return html`
      <div class="app-wrapper">
        <div class="container">
          <header class="header">
            <h1>Simulatore Mutuo</h1>
          </header>

          <div class="tabs-container">
            <div class="tabs-nav">
              ${this.tabs.map(
                (tab) => html`
                  <button
                    class="tab-btn ${this.activeTabId === tab.id ? 'active' : ''}"
                    @click=${() => this.switchTab(tab.id)}
                  >
                    ${tab.name}
                    ${!tab.isFixed
                      ? html`
                          <button
                            class="tab-close-btn"
                            @click=${(e: Event) => {
                              e.stopPropagation();
                              this.deleteTab(tab.id);
                            }}
                            title="Delete tab"
                          >
                            ✕
                          </button>
                        `
                      : ''}
                  </button>
                `
              )}
              <button class="add-tab-btn" @click=${this.openAddTabDialog} title="Add new tab">
                + Aggiungi
              </button>
              <button
                class="virtual-mortgage-btn"
                @click=${this.openVirtualMortgageSelector}
                title="Create virtual mortgage"
              >
                ⊕ Mutuo Virtuale
              </button>
            </div>

            <div class="tabs-content">
              ${activeTab
                ? activeTab.id === 'impostazioni'
                  ? html`
                      <div class="tab-panel">
                        <h2>Impostazioni</h2>
                        <div class="settings-section">
                          <button
                            class="debug-toggle-btn"
                            @click=${() => {
                              this.showDebug = !this.showDebug;
                            }}
                          >
                            ${this.showDebug ? '🔽' : '▶️'} Debug
                          </button>
                        </div>
                        ${this.showDebug
                          ? html`
                              <div class="debug-section">
                                <div class="debug-header">
                                  <h3>LocalStorage Contents</h3>
                                  <div class="debug-actions">
                                    <button
                                      class="btn-secondary"
                                      @click=${() =>
                                        this.copyToClipboard(
                                          JSON.stringify(this.getLocalStorageData(), null, 2)
                                        )}
                                      title="Copy JSON to clipboard"
                                    >
                                      📋 Copy
                                    </button>
                                    <button
                                      class="btn-danger"
                                      @click=${this.clearAllLocalStorage}
                                      title="Clear all localStorage"
                                    >
                                      🗑️ Clear All
                                    </button>
                                  </div>
                                </div>
                                <div class="json-display">
                                  <pre>${JSON.stringify(this.getLocalStorageData(), null, 2)}</pre>
                                </div>
                              </div>
                            `
                          : ''}
                      </div>
                    `
                  : activeTab.id === 'resoconto'
                    ? html` <mortgages-summary .tabs=${this.tabs}></mortgages-summary> `
                    : activeTab.isVirtual
                      ? html`
                          <virtual-mortgage-tab
                            .tabId=${activeTab.id}
                            .tabName=${activeTab.name}
                            @delete-virtual-tab=${this.handleDeleteVirtualTab}
                          ></virtual-mortgage-tab>
                        `
                      : html`
                          <mortgage-tab
                            .tabId=${activeTab.id}
                            .tabName=${activeTab.name}
                          ></mortgage-tab>
                        `
                : html`<div class="tab-panel"><p>No tabs available</p></div>`}
            </div>
          </div>
        </div>
      </div>

      <!-- Disclaimer Banner -->
      <div class="disclaimer-banner">
        ⚠️ <strong>Avvertenza:</strong> Questo strumento può fare errori. L'autore non è
        responsabile per eventuali rischi, perdite o errori che possono derivare dal suo utilizzo.
        Si prega di verificare indipendentemente tutti i calcoli prima di prendere decisioni
        finanziarie.
      </div>

      <!-- Footer -->
      <footer class="app-footer">
        <a
          href="https://github.com/alcaprar/simulatore-mutuo"
          target="_blank"
          rel="noopener noreferrer"
        >
          📄 Repository
        </a>
      </footer>

      <!-- Add Tab Dialog -->
      ${this.showAddTabDialog
        ? html`
            <div class="modal-backdrop" @click=${this.closeAddTabDialog}>
              <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
                <div class="modal-header">
                  <h2>Aggiungi Nuova Scheda</h2>
                  <button class="modal-close-btn" @click=${this.closeAddTabDialog}>✕</button>
                </div>
                <div class="modal-body">
                  <input
                    type="text"
                    class="tab-name-input"
                    placeholder="Nome della scheda"
                    .value=${this.newTabName}
                    @input=${(e: Event) => {
                      this.newTabName = (e.target as HTMLInputElement).value;
                    }}
                    @keydown=${this.handleKeyDown}
                    autofocus
                  />
                </div>
                <div class="modal-footer">
                  <button class="btn-cancel" @click=${this.closeAddTabDialog}>Annulla</button>
                  <button
                    class="btn-primary"
                    @click=${this.addNewTab}
                    ?disabled=${!this.newTabName.trim()}
                  >
                    Aggiungi
                  </button>
                </div>
              </div>
            </div>
          `
        : ''}
      ${this.showVirtualMortgageSelector
        ? html`
            <virtual-mortgage-selector
              .availableMortgages=${this.availableMortgagesForVirtual}
              @virtual-created=${this.addVirtualMortgage}
              @virtual-cancelled=${this.closeVirtualMortgageSelector}
            ></virtual-mortgage-selector>
          `
        : ''}
    `;
  }

  static styles = css`
    :host {
      --primary: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;

      display: block;
      background: var(--gray-50);
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--gray-900);
    }

    .app-wrapper {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
      padding: 1rem;
    }

    .header {
      padding: 0 0 1rem 0;
      border-bottom: 2px solid var(--gray-200);
      margin-bottom: 2rem;
    }

    h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary);
    }

    .tabs-container {
      margin-top: 1rem;
    }

    .tabs-nav {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0;
      border-bottom: 2px solid var(--gray-200);
      flex-wrap: wrap;
      align-items: center;
    }

    .tab-btn {
      padding: 1rem 1.5rem;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      font-size: 1rem;
      font-weight: 600;
      color: var(--gray-700);
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: -2px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      position: relative;
    }

    .tab-btn:hover {
      color: var(--primary);
    }

    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }

    .tab-close-btn {
      background: none;
      border: none;
      color: currentColor;
      cursor: pointer;
      font-size: 0.875rem;
      padding: 0 0.25rem;
      display: inline-flex;
      align-items: center;
      opacity: 0.6;
      transition: opacity 0.2s;
      margin-left: 0.25rem;
    }

    .tab-close-btn:hover {
      opacity: 1;
    }

    .add-tab-btn {
      padding: 1rem 1.5rem;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      font-size: 1rem;
      font-weight: 600;
      color: var(--gray-700);
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: -2px;
    }

    .add-tab-btn:hover {
      color: var(--success);
    }

    .virtual-mortgage-btn {
      padding: 1rem 1.5rem;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      font-size: 1rem;
      font-weight: 600;
      color: var(--gray-700);
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: -2px;
    }

    .virtual-mortgage-btn:hover {
      color: #9333ea;
    }

    .tabs-content {
      animation: fadeIn 0.2s ease-in;
    }

    .tab-panel {
      padding: 1.5rem;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .placeholder {
      color: var(--gray-700);
      margin: 0;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* Modal Styles */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
      max-width: 400px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--gray-200);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .modal-close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--gray-700);
      padding: 0;
      line-height: 1;
      transition: color 0.2s;
    }

    .modal-close-btn:hover {
      color: var(--gray-900);
    }

    .modal-body {
      padding: 1.5rem;
    }

    .tab-name-input {
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 1rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    .tab-name-input:focus {
      outline: none;
      border-color: var(--primary);
    }

    .modal-footer {
      padding: 1.5rem;
      border-top: 1px solid var(--gray-200);
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }

    .btn-cancel,
    .btn-primary {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel {
      background: var(--gray-200);
      color: var(--gray-900);
    }

    .btn-cancel:hover {
      background: var(--gray-300);
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary,
    .btn-danger {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: var(--gray-200);
      color: var(--gray-900);
    }

    .btn-secondary:hover {
      background: var(--gray-300);
    }

    .btn-danger {
      background: var(--danger);
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .debug-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--gray-200);
    }

    .debug-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .debug-actions {
      display: flex;
      gap: 0.5rem;
    }

    .json-display {
      flex: 1;
      background: var(--gray-900);
      border-radius: 0.5rem;
      padding: 1rem;
      overflow: auto;
      min-height: 400px;
    }

    .json-display pre {
      margin: 0;
      color: #10b981;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.875rem;
      line-height: 1.6;
    }

    .settings-section {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--gray-200);
    }

    .debug-toggle-btn {
      padding: 0.75rem 1rem;
      background: var(--gray-100);
      border: 2px solid var(--gray-300);
      border-radius: 0.5rem;
      color: var(--gray-900);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.95rem;
    }

    .debug-toggle-btn:hover {
      background: var(--gray-200);
      border-color: var(--gray-400);
    }

    .debug-section {
      margin-top: 1.5rem;
      padding: 1rem;
      background: var(--gray-50);
      border-radius: 0.5rem;
      border: 2px solid var(--gray-200);
    }

    .disclaimer-banner {
      padding: 1rem 1.5rem;
      margin: 0 0 1rem 0;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      color: #92400e;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .app-footer {
      padding: 1.5rem;
      text-align: center;
      border-top: 1px solid var(--gray-200);
      margin-top: 2rem;
    }

    .app-footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }

    .app-footer a:hover {
      color: #1d4ed8;
      text-decoration: underline;
    }

    @media (max-width: 640px) {
      .container {
        padding: 0.75rem;
      }

      h1 {
        font-size: 1.5rem;
      }

      .tab-btn {
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
      }

      .add-tab-btn {
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
      }

      .modal {
        width: 95%;
      }

      .disclaimer-banner {
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        margin: 0 0 0.75rem 0;
      }

      .app-footer {
        padding: 1rem;
        margin-top: 1.5rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'mutuo-app': MutuoApp;
  }
}
