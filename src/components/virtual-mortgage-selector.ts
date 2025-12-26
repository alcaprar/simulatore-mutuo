import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MortgageData } from '../types.js';

@customElement('virtual-mortgage-selector')
export class VirtualMortgageSelector extends LitElement {
  @property({ type: Array })
  availableMortgages: Array<{ tabId: string; mortgage: MortgageData }> = [];

  @state()
  private selectedTabIds: Set<string> = new Set();

  @state()
  private virtualName: string = '';

  private getMonthName(mese: number): string {
    const months = [
      'gennaio',
      'febbraio',
      'marzo',
      'aprile',
      'maggio',
      'giugno',
      'luglio',
      'agosto',
      'settembre',
      'ottobre',
      'novembre',
      'dicembre',
    ];
    return months[mese] || '';
  }

  private getEndDate(mortgage: MortgageData): { month: string; year: number } {
    const { annoPartenza, mesePartenza, durataAnni } = mortgage.input;
    let endMonth = mesePartenza + durataAnni * 12;
    let endYear = annoPartenza;

    endYear += Math.floor(endMonth / 12);
    endMonth = endMonth % 12;

    return {
      month: this.getMonthName(endMonth),
      year: endYear,
    };
  }

  private handleMortgageToggle(tabId: string): void {
    if (this.selectedTabIds.has(tabId)) {
      this.selectedTabIds.delete(tabId);
    } else {
      this.selectedTabIds.add(tabId);
    }
    this.requestUpdate();
  }

  private handleCreate(): void {
    if (this.selectedTabIds.size >= 2 && this.virtualName.trim()) {
      this.dispatchEvent(
        new CustomEvent('virtual-created', {
          detail: {
            name: this.virtualName,
            sourceIds: Array.from(this.selectedTabIds),
          },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private handleCancel(): void {
    this.dispatchEvent(
      new CustomEvent('virtual-cancelled', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.selectedTabIds.size >= 2 && this.virtualName.trim()) {
      this.handleCreate();
    }
  }

  render() {
    const isValid = this.selectedTabIds.size >= 2 && this.virtualName.trim();

    return html`
      <div class="selector-container">
        <div class="selector-modal">
          <div class="modal-header">
            <h2>Crea Mutuo Virtuale</h2>
            <button class="close-btn" @click=${this.handleCancel}>✕</button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label for="virtual-name">Nome Mutuo Virtuale</label>
              <input
                id="virtual-name"
                type="text"
                placeholder="es. Mutuo Acquisto + Ristrutturazione"
                .value=${this.virtualName}
                @input=${(e: Event) => {
                  this.virtualName = (e.target as HTMLInputElement).value;
                }}
                @keydown=${this.handleKeyDown}
                autofocus
              />
            </div>

            <div class="form-group">
              <label>Seleziona Mutui (minimo 2)</label>
              <div class="mortgages-list">
                ${this.availableMortgages.map(
                  (item) => html`
                    <div class="mortgage-item">
                      <label class="checkbox-label">
                        <input
                          type="checkbox"
                          ?checked=${this.selectedTabIds.has(item.tabId)}
                          @change=${() => this.handleMortgageToggle(item.tabId)}
                        />
                        <div class="mortgage-info">
                          <div class="mortgage-name">${item.mortgage.nome}</div>
                          <div class="mortgage-details">
                            ${new Intl.NumberFormat('it-IT', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(item.mortgage.input.importoTotale)}
                            @ ${item.mortgage.input.tassoInteresse.toFixed(2)}% •
                            ${this.getMonthName(item.mortgage.input.mesePartenza)}
                            ${item.mortgage.input.annoPartenza} -
                            ${this.getEndDate(item.mortgage).month}
                            ${this.getEndDate(item.mortgage).year}
                          </div>
                        </div>
                      </label>
                    </div>
                  `
                )}
              </div>
            </div>

            ${this.selectedTabIds.size < 2
              ? html`
                  <div class="info-message">
                    ℹ️ Seleziona almeno 2 mutui per creare un mutuo virtuale
                  </div>
                `
              : ''}
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click=${this.handleCancel}>Annulla</button>
            <button class="btn-primary" @click=${this.handleCreate} ?disabled=${!isValid}>
              Crea Mutuo Virtuale
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .selector-container {
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

    .selector-modal {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateY(-50px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 2px solid var(--gray-200);
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--gray-900);
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--gray-400);
      cursor: pointer;
      padding: 0;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.5rem;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: var(--gray-100);
      color: var(--gray-600);
    }

    .modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      font-weight: 600;
      color: var(--gray-700);
      margin-bottom: 0.75rem;
      font-size: 0.95rem;
    }

    input[type='text'] {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      font-family: inherit;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    input[type='text']:focus {
      outline: none;
      border-color: var(--primary);
    }

    .mortgages-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .mortgage-item {
      padding: 1rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      transition: all 0.2s;
    }

    .mortgage-item:has(input:checked) {
      border-color: var(--primary);
      background: linear-gradient(
        135deg,
        rgba(59, 130, 246, 0.05) 0%,
        rgba(59, 130, 246, 0.02) 100%
      );
    }

    .checkbox-label {
      display: flex;
      gap: 1rem;
      cursor: pointer;
      align-items: flex-start;
    }

    input[type='checkbox'] {
      width: 1.25rem;
      height: 1.25rem;
      margin-top: 0.125rem;
      cursor: pointer;
      accent-color: var(--primary);
      flex-shrink: 0;
    }

    .mortgage-info {
      flex: 1;
    }

    .mortgage-name {
      font-weight: 600;
      color: var(--gray-900);
      margin-bottom: 0.25rem;
    }

    .mortgage-details {
      font-size: 0.85rem;
      color: var(--gray-600);
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .info-message {
      padding: 1rem;
      background: rgba(59, 130, 246, 0.1);
      border-left: 4px solid var(--primary);
      border-radius: 0.5rem;
      color: var(--primary);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .modal-footer {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      padding: 1.5rem;
      border-top: 2px solid var(--gray-200);
      background: var(--gray-50);
    }

    button {
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
      flex: 1;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 640px) {
      .selector-modal {
        width: 95%;
        max-height: 90vh;
      }

      .modal-footer {
        flex-direction: column;
      }

      button {
        width: 100%;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'virtual-mortgage-selector': VirtualMortgageSelector;
  }
}
