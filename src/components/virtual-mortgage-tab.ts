import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MortgageData, VirtualMortgageData, VirtualAmortizationRow } from '../types.js';
import { StorageService } from '../storage.js';
import { VirtualMortgageCalculator } from '../utils/virtual-mortgage-calculator.js';
import './virtual-amortization-table.js';

@customElement('virtual-mortgage-tab')
export class VirtualMortgageTab extends LitElement {
  @property({ type: String })
  tabId: string = '';

  @property({ type: String })
  tabName: string = '';

  @state()
  private virtualMortgage: VirtualMortgageData | null = null;

  @state()
  private sourceMortgages: MortgageData[] = [];

  @state()
  private combinedAmortization: VirtualAmortizationRow[] = [];

  @state()
  private showDeleteConfirm: boolean = false;

  connectedCallback() {
    super.connectedCallback();
    this.loadVirtualMortgage();
  }

  private loadVirtualMortgage(): void {
    if (!this.tabId) return;

    this.virtualMortgage = StorageService.getVirtualMortgage(this.tabId);

    if (!this.virtualMortgage) {
      console.error(`Virtual mortgage not found for tab ${this.tabId}`);
      return;
    }

    // Load source mortgages
    this.sourceMortgages = StorageService.getSourceMortgages(this.virtualMortgage.sourceIds);

    // Generate combined amortization
    if (this.sourceMortgages.length > 0) {
      this.combinedAmortization = VirtualMortgageCalculator.mergeAmortizationSchedules(
        this.sourceMortgages
      );
    }
  }

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

  private navigateToMortgage(mortgageTabId: string): void {
    window.location.hash = mortgageTabId;
  }

  private handleDeleteVirtual(): void {
    this.showDeleteConfirm = true;
  }

  private confirmDeleteVirtual(): void {
    if (!this.tabId) return;

    StorageService.deleteVirtualMortgage(this.tabId);

    // Emit event to parent to remove tab
    this.dispatchEvent(
      new CustomEvent('delete-virtual-tab', {
        detail: { tabId: this.tabId },
        bubbles: true,
        composed: true,
      })
    );
  }

  private cancelDeleteVirtual(): void {
    this.showDeleteConfirm = false;
  }

  render() {
    if (!this.virtualMortgage || this.sourceMortgages.length === 0) {
      return html`<div class="no-data">Mutuo virtuale non trovato o invalido</div>`;
    }

    const totalAmount = VirtualMortgageCalculator.calculateTotalAmount(this.sourceMortgages);
    const totalInterest = VirtualMortgageCalculator.calculateTotalInterest(this.sourceMortgages);
    const totalFees = VirtualMortgageCalculator.calculateTotalFees(this.sourceMortgages);
    const totalCost = totalInterest + totalFees;

    return html`
      <div class="virtual-mortgage-tab-container">
        <div class="results-header">
          <div class="title-section">
            <h2>⊕ ${this.virtualMortgage.nome}</h2>
            <span class="virtual-badge">Virtual</span>
          </div>
          <div class="results-actions">
            <button class="btn-danger" @click=${this.handleDeleteVirtual}>🗑️ Elimina</button>
          </div>
        </div>

        <div class="source-mortgages">
          <h3>Mutui Componenti</h3>
          <div class="mortgages-grid">
            ${this.sourceMortgages.map(
              (mortgage) => html`
                <div class="mortgage-card">
                  <div class="mortgage-card-header">
                    <h4>${mortgage.nome}</h4>
                    <button class="view-btn" @click=${() => this.navigateToMortgage(mortgage.id)}>
                      Visualizza →
                    </button>
                  </div>
                  <div class="mortgage-card-details">
                    <div class="detail-row">
                      <span class="label">Importo:</span>
                      <span class="value">
                        ${new Intl.NumberFormat('it-IT', {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(mortgage.input.importoTotale)}
                      </span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Tasso:</span>
                      <span class="value">${mortgage.input.tassoInteresse.toFixed(2)}%</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Periodo:</span>
                      <span class="value">
                        ${this.getMonthName(mortgage.input.mesePartenza)}
                        ${mortgage.input.annoPartenza} - ${this.getEndDate(mortgage).month}
                        ${this.getEndDate(mortgage).year}
                      </span>
                    </div>
                  </div>
                </div>
              `
            )}
          </div>
        </div>

        <div class="combined-summary">
          <h3>Riepilogo Combinato</h3>
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-label">Importo Totale</div>
              <div class="summary-value">
                ${new Intl.NumberFormat('it-IT', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(totalAmount)}
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Periodo</div>
              <div class="summary-value">
                ${this.combinedAmortization.length > 0
                  ? html`
                      ${this.getMonthName(this.combinedAmortization[0].mese)}
                      ${this.combinedAmortization[0].anno} -
                      ${this.getMonthName(
                        this.combinedAmortization[this.combinedAmortization.length - 1].mese
                      )}
                      ${this.combinedAmortization[this.combinedAmortization.length - 1].anno}
                    `
                  : 'N/A'}
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Interessi Totali</div>
              <div class="summary-value">
                ${new Intl.NumberFormat('it-IT', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(totalInterest)}
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Spese Totali</div>
              <div class="summary-value">
                ${new Intl.NumberFormat('it-IT', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(totalFees)}
              </div>
            </div>
            <div class="summary-card grand-total">
              <div class="summary-label">Costo Totale</div>
              <div class="summary-value">
                ${new Intl.NumberFormat('it-IT', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(totalCost)}
              </div>
            </div>
          </div>
        </div>

        <div class="table-section">
          <h3>Piano di Ammortamento Combinato</h3>
          <p class="table-info">
            La tabella mostra il pagamento complessivo per ogni mese, con il numero di mutui attivi.
            Clicca su una riga per vedere il contributo di ogni mutuo.
          </p>
          <virtual-amortization-table .rows=${this.combinedAmortization}>
          </virtual-amortization-table>
        </div>

        <div class="early-closure-section">
          <h3>Chiusura Anticipata (Per Mutuo)</h3>
          <p class="info">
            La chiusura anticipata è calcolata separatamente per ogni mutuo, poiché possono avere
            termini e strategie di risparmio diversi.
          </p>
          ${this.sourceMortgages.map(
            (mortgage) => html`
              <div class="mortgage-closure-card">
                <h4>${mortgage.nome}</h4>
                <button class="view-link" @click=${() => this.navigateToMortgage(mortgage.id)}>
                  Visualizza dettagli →
                </button>
              </div>
            `
          )}
        </div>

        ${this.showDeleteConfirm
          ? html`
              <div class="delete-confirm-overlay">
                <div class="delete-confirm-dialog">
                  <h3>Elimina Mutuo Virtuale</h3>
                  <p>
                    Sei sicuro di voler eliminare il mutuo virtuale " ${this.virtualMortgage.nome}"?
                  </p>
                  <p class="info-text">
                    I mutui componenti non verranno eliminati, solo il mutuo virtuale sarà rimosso.
                  </p>
                  <div class="dialog-actions">
                    <button class="btn-cancel" @click=${this.cancelDeleteVirtual}>Annulla</button>
                    <button class="btn-danger" @click=${this.confirmDeleteVirtual}>Elimina</button>
                  </div>
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .virtual-mortgage-tab-container {
      padding: 1.5rem;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    h2,
    h3,
    h4 {
      color: var(--gray-900);
      margin: 0 0 1rem 0;
    }

    h2 {
      font-size: 1.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    h3 {
      font-size: 1.1rem;
      margin: 2rem 0 1rem 0;
    }

    h4 {
      font-size: 1rem;
      margin: 0 0 0.5rem 0;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--gray-200);
    }

    .title-section {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .virtual-badge {
      background: #9333ea;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .results-actions {
      display: flex;
      gap: 0.5rem;
    }

    button {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-danger {
      background: var(--danger);
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .source-mortgages {
      margin: 2rem 0;
    }

    .mortgages-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }

    .mortgage-card {
      padding: 1rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      background: var(--gray-50);
    }

    .mortgage-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .view-btn {
      background: var(--primary);
      color: white;
      padding: 0.375rem 0.75rem;
      font-size: 0.8rem;
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
      white-space: nowrap;
    }

    .view-btn:hover {
      background: #2563eb;
    }

    .mortgage-card-details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
    }

    .detail-row .label {
      color: var(--gray-700);
      font-weight: 500;
    }

    .detail-row .value {
      color: var(--primary);
      font-weight: 600;
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .combined-summary {
      margin: 2rem 0;
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .summary-card {
      padding: 1.5rem;
      background: white;
      border-radius: 0.5rem;
      border-left: 4px solid var(--primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    .summary-card.grand-total {
      border-left-color: var(--success);
      background: linear-gradient(
        135deg,
        rgba(16, 185, 129, 0.05) 0%,
        rgba(16, 185, 129, 0.02) 100%
      );
    }

    .summary-label {
      font-size: 0.9rem;
      color: var(--gray-700);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }

    .summary-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .summary-card.grand-total .summary-value {
      color: var(--success);
      font-size: 1.75rem;
    }

    .table-section {
      margin: 2rem 0;
    }

    .table-info {
      color: var(--gray-700);
      font-size: 0.9rem;
      margin: 0.5rem 0 1rem 0;
      font-style: italic;
    }

    .early-closure-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: var(--gray-50);
      border-radius: 0.5rem;
      border: 2px solid var(--primary);
    }

    .info {
      color: var(--gray-700);
      font-size: 0.9rem;
      margin: 0 0 1rem 0;
    }

    .mortgage-closure-card {
      padding: 1rem;
      background: white;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .mortgage-closure-card h4 {
      margin: 0;
    }

    .view-link {
      background: none;
      border: none;
      color: var(--primary);
      cursor: pointer;
      font-size: 0.9rem;
      padding: 0;
      text-decoration: none;
      transition: color 0.2s;
    }

    .view-link:hover {
      color: #2563eb;
      text-decoration: underline;
    }

    .delete-confirm-overlay {
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

    .delete-confirm-dialog {
      background: white;
      border-radius: 0.75rem;
      padding: 2rem;
      max-width: 400px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }

    .delete-confirm-dialog h3 {
      margin: 0 0 1rem 0;
      color: var(--danger);
    }

    .delete-confirm-dialog p {
      color: var(--gray-700);
      margin: 0.5rem 0;
      line-height: 1.5;
    }

    .info-text {
      font-size: 0.85rem;
      color: var(--gray-600);
      font-style: italic;
    }

    .dialog-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      justify-content: flex-end;
    }

    .btn-cancel {
      background: var(--gray-200);
      color: var(--gray-900);
    }

    .btn-cancel:hover {
      background: var(--gray-300);
    }

    .no-data {
      padding: 2rem;
      text-align: center;
      color: var(--gray-700);
    }

    @media (max-width: 768px) {
      .results-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .results-actions {
        width: 100%;
      }

      .btn-danger {
        width: 100%;
      }

      .mortgage-card-header {
        flex-direction: column;
        gap: 0.5rem;
      }

      .view-btn {
        width: 100%;
      }

      .mortgage-closure-card {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'virtual-mortgage-tab': VirtualMortgageTab;
  }
}
