import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { AppTab } from './types.js'
import './components/mortgage-tab.js'
import './components/mortgages-summary.js'

@customElement('mutuo-app')
export class MutuoApp extends LitElement {
  @state()
  private tabs: AppTab[] = [
    { id: 'impostazioni', name: 'Impostazioni', isFixed: true },
    { id: 'resoconto', name: 'Resoconto', isFixed: true },
    { id: 'debug', name: 'Debug', isFixed: true },
  ]

  @state()
  private activeTabId: string = 'impostazioni'

  @state()
  private showAddTabDialog: boolean = false

  @state()
  private newTabName: string = ''

  @state()
  private editingTabId: string | null = null

  @state()
  private editingTabName: string = ''

  private boundHandleRouteChange = () => this.handleRouteChange()

  connectedCallback() {
    super.connectedCallback()
    this.loadTabsFromStorage()
    window.addEventListener('hashchange', this.boundHandleRouteChange)
    this.handleRouteChange()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('hashchange', this.boundHandleRouteChange)
  }

  private loadTabsFromStorage(): void {
    const storedTabs = localStorage.getItem('mutuo-tabs')
    if (storedTabs) {
      try {
        this.tabs = JSON.parse(storedTabs)
      } catch (e) {
        console.error('Failed to load tabs from storage:', e)
      }
    }
  }

  private saveTabsToStorage(): void {
    localStorage.setItem('mutuo-tabs', JSON.stringify(this.tabs))
  }

  private switchTab(tabId: string): void {
    window.location.hash = tabId
  }

  private handleRouteChange(): void {
    const hash = window.location.hash.slice(1) || ''

    if (hash) {
      // Check if tab exists
      if (this.tabs.some((t) => t.id === hash)) {
        this.activeTabId = hash
      } else {
        // Tab doesn't exist, go to first tab
        window.location.hash = this.tabs[0].id
      }
    } else {
      // No hash, set to first tab
      window.location.hash = this.tabs[0].id
    }
  }

  private generateTabId(name: string): string {
    // Generate a slug from the name
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^\w\-]/g, '') // Remove non-word characters except hyphens
      .replace(/\-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^\-+|\-+$/g, '') // Remove leading/trailing hyphens
  }

  private openAddTabDialog(): void {
    this.showAddTabDialog = true
    this.newTabName = ''
  }

  private closeAddTabDialog(): void {
    this.showAddTabDialog = false
    this.newTabName = ''
  }

  private addNewTab(): void {
    if (this.newTabName.trim()) {
      let newId = this.generateTabId(this.newTabName)

      // Ensure unique ID by appending a number if needed
      let counter = 1
      const baseId = newId
      while (this.tabs.some((t) => t.id === newId)) {
        newId = `${baseId}-${counter}`
        counter++
      }

      this.tabs = [
        ...this.tabs,
        {
          id: newId,
          name: this.newTabName.trim(),
          isFixed: false,
        },
      ]
      this.saveTabsToStorage()
      this.switchTab(newId)
      this.closeAddTabDialog()
    }
  }

  private deleteTab(tabId: string): void {
    const tabToDelete = this.tabs.find((t) => t.id === tabId)
    if (tabToDelete?.isFixed) {
      return // Cannot delete fixed tabs
    }

    this.tabs = this.tabs.filter((t) => t.id !== tabId)
    this.saveTabsToStorage()

    // Switch to another tab if the active tab was deleted
    if (this.activeTabId === tabId) {
      this.switchTab(this.tabs[0].id)
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (this.editingTabId) {
        this.saveTabNameEdit()
      } else {
        this.addNewTab()
      }
    } else if (event.key === 'Escape') {
      if (this.editingTabId) {
        this.closeTabNameEdit()
      } else {
        this.closeAddTabDialog()
      }
    }
  }

  private openTabNameEdit(tabId: string, currentName: string): void {
    this.editingTabId = tabId
    this.editingTabName = currentName
  }

  private closeTabNameEdit(): void {
    this.editingTabId = null
    this.editingTabName = ''
  }

  private saveTabNameEdit(): void {
    if (!this.editingTabId || !this.editingTabName.trim()) {
      return
    }

    // Update the tab name
    const tabIndex = this.tabs.findIndex((t) => t.id === this.editingTabId)
    if (tabIndex >= 0) {
      this.tabs[tabIndex].name = this.editingTabName.trim()
      this.tabs = [...this.tabs] // Trigger reactivity
      this.saveTabsToStorage()
    }

    this.closeTabNameEdit()
  }

  private getLocalStorageData(): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        try {
          data[key] = value ? JSON.parse(value) : value
        } catch {
          data[key] = value
        }
      }
    }
    return data
  }

  private clearAllLocalStorage(): void {
    if (confirm('Are you sure you want to clear all localStorage? This cannot be undone.')) {
      localStorage.clear()
      // Reload to reset the app
      window.location.reload()
    }
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!')
    })
  }

  render() {
    const activeTab = this.tabs.find((t) => t.id === this.activeTabId)

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
                  ${this.editingTabId === tab.id
                    ? html`
                        <div class="tab-edit-container">
                          <input
                            type="text"
                            class="tab-edit-input"
                            .value=${this.editingTabName}
                            @input=${(e: Event) => {
                              this.editingTabName = (e.target as HTMLInputElement).value
                            }}
                            @keydown=${this.handleKeyDown}
                            autofocus
                          />
                          <button
                            class="tab-edit-confirm"
                            @click=${this.saveTabNameEdit}
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            class="tab-edit-cancel"
                            @click=${this.closeTabNameEdit}
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      `
                    : html`
                        <button
                          class="tab-btn ${this.activeTabId === tab.id ? 'active' : ''}"
                          @click=${() => this.switchTab(tab.id)}
                        >
                          ${tab.name}
                          ${!tab.isFixed
                            ? html`
                                <button
                                  class="tab-edit-btn"
                                  @click=${(e: Event) => {
                                    e.stopPropagation()
                                    this.openTabNameEdit(tab.id, tab.name)
                                  }}
                                  title="Edit tab name"
                                >
                                  ✎
                                </button>
                                <button
                                  class="tab-close-btn"
                                  @click=${(e: Event) => {
                                    e.stopPropagation()
                                    this.deleteTab(tab.id)
                                  }}
                                  title="Delete tab"
                                >
                                  ✕
                                </button>
                              `
                            : ''}
                        </button>
                      `}
                `
              )}
              <button class="add-tab-btn" @click=${this.openAddTabDialog} title="Add new tab">
                + Aggiungi
              </button>
            </div>

            <div class="tabs-content">
              ${activeTab
                ? activeTab.id === 'debug'
                  ? html`
                      <div class="tab-panel debug-panel">
                        <div class="debug-header">
                          <h3>LocalStorage Contents</h3>
                          <div class="debug-actions">
                            <button
                              class="btn-secondary"
                              @click=${() => this.copyToClipboard(JSON.stringify(this.getLocalStorageData(), null, 2))}
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
                  : activeTab.id === 'impostazioni'
                    ? html`
                        <div class="tab-panel">
                          <p class="placeholder">
                            Scheda per configurare le impostazioni generali dell'app
                          </p>
                        </div>
                      `
                    : activeTab.id === 'resoconto'
                      ? html`
                          <mortgages-summary .tabs=${this.tabs}></mortgages-summary>
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
                      this.newTabName = (e.target as HTMLInputElement).value
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
    `
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

    .tab-edit-btn {
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

    .tab-edit-btn:hover {
      opacity: 1;
    }

    .tab-edit-container {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      margin-bottom: -2px;
    }

    .tab-edit-input {
      padding: 0.5rem;
      border: 2px solid var(--primary);
      border-radius: 0.25rem;
      font-size: 1rem;
      font-weight: 600;
      font-family: inherit;
      min-width: 120px;
    }

    .tab-edit-input:focus {
      outline: none;
      border-color: #2563eb;
    }

    .tab-edit-confirm,
    .tab-edit-cancel {
      padding: 0.25rem 0.5rem;
      border: none;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.2s;
    }

    .tab-edit-confirm {
      background: var(--success);
      color: white;
    }

    .tab-edit-confirm:hover {
      background: #059669;
    }

    .tab-edit-cancel {
      background: var(--danger);
      color: white;
    }

    .tab-edit-cancel:hover {
      background: #dc2626;
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
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'mutuo-app': MutuoApp
  }
}
