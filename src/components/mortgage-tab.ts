import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { MortgageData, MortgageInput, EarlyClosureData } from '../types.js'
import { StorageService } from '../storage.js'
import { MortgageCalculator } from '../utils/mortgage-calculator.js'
import './mortgage-form.js'
import './amortization-table.js'

@customElement('mortgage-tab')
export class MortgageTab extends LitElement {
  @property({ type: String })
  tabId: string = ''

  @property({ type: String })
  tabName: string = ''

  @state()
  private mortgage: MortgageData | null = null

  @state()
  private showForm: boolean = true

  private lastTabId?: string

  connectedCallback() {
    super.connectedCallback()
    this.loadMortgage()
  }

  updated(changedProperties: Map<string, unknown>) {
    // Reload mortgage when tabId changes
    if (changedProperties.has('tabId') && this.tabId && this.tabId !== this.lastTabId) {
      this.loadMortgage()
    }
  }

  private loadMortgage(): void {
    if (this.tabId) {
      this.lastTabId = this.tabId
      this.mortgage = StorageService.getMortgage(this.tabId)
      this.showForm = !this.mortgage
    }
  }

  private handleMortgageCalculated(event: CustomEvent<{ input: MortgageInput }>): void {
    if (!this.tabId) return

    const input = event.detail.input
    // Use tab name if no mortgage name, or create one from the bank name
    const nome = this.tabName || `Mutuo ${new Date().toLocaleDateString('it-IT')}`

    this.mortgage = StorageService.createMortgage(this.tabId, nome, input)
    this.showForm = false
  }

  private handleEditMortgage(): void {
    this.showForm = true
  }

  private handleDeleteMortgage(): void {
    if (confirm('Sei sicuro di voler eliminare questo mutuo?')) {
      StorageService.deleteMortgage(this.tabId)
      this.mortgage = null
      this.showForm = true
    }
  }

  render() {
    return html`
      <div class="mortgage-tab-container">
        ${this.showForm
          ? html`
              <div class="form-section">
                <h2>Simula Mutuo - ${this.tabName}</h2>
                <mortgage-form
                  .initialInput=${this.mortgage?.input}
                  @mortgage-calculated=${this.handleMortgageCalculated}
                ></mortgage-form>
              </div>
            `
          : this.mortgage
            ? html`
                <div class="results-section">
                  <div class="results-header">
                    <h2>${this.mortgage.nome}</h2>
                    <div class="results-actions">
                      <button class="btn-secondary" @click=${this.handleEditMortgage}>
                        ✎ Modifica
                      </button>
                      <button class="btn-danger" @click=${this.handleDeleteMortgage}>
                        🗑️ Elimina
                      </button>
                    </div>
                  </div>

                  <div class="mortgage-summary">
                    <div class="summary-section">
                      <h3>Parametri Mutuo</h3>
                      <dl class="summary-list">
                        <dt>Importo:</dt>
                        <dd>${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(this.mortgage.input.importoTotale)}</dd>

                        <dt>Durata:</dt>
                        <dd>${this.mortgage.input.durataAnni} anni (${this.mortgage.input.durataAnni * 12} mesi)</dd>

                        <dt>Tasso Interesse:</dt>
                        <dd>${this.mortgage.input.tassoInteresse.toFixed(2)}% annuale</dd>

                        <dt>Inizio:</dt>
                        <dd>
                          ${this._getMonthName(this.mortgage.input.mesePartenza)}
                          ${this.mortgage.input.annoPartenza}
                        </dd>
                      </dl>
                    </div>

                    <div class="summary-section">
                      <h3>Spese</h3>
                      <dl class="summary-list">
                        <dt>Istruttoria:</dt>
                        <dd>
                          ${this.mortgage.input.speseIstruttoria.tipo === 'percentage'
                            ? `${this.mortgage.input.speseIstruttoria.valore.toFixed(2)}% dell'importo`
                            : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(this.mortgage.input.speseIstruttoria.valore)}
                        </dd>

                        <dt>Incasso Rata:</dt>
                        <dd>
                          ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(this.mortgage.input.speseIncassoRata)}/mese
                        </dd>

                        <dt>Perizia:</dt>
                        <dd>${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(this.mortgage.input.spesaPerizia)}</dd>
                      </dl>
                    </div>
                  </div>

                  <div class="expense-summary">
                    <div class="expense-card">
                      <div class="expense-label">Totale Interessi</div>
                      <div class="expense-value">
                        ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(this._calculateTotalInterests())}
                      </div>
                    </div>
                    <div class="expense-card">
                      <div class="expense-label">Totale Altre Spese</div>
                      <div class="expense-value">
                        ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(this._calculateTotalOtherCosts())}
                      </div>
                    </div>
                    <div class="expense-card grand-total">
                      <div class="expense-label">Costo Totale</div>
                      <div class="expense-value">
                        ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(this._calculateGrandTotal())}
                      </div>
                    </div>
                    <div class="expense-card comparison-card">
                      <div class="expense-label">Costo Effettivo</div>
                      <div class="expense-value">
                        ${this._calculateEffectiveRate().toFixed(2)}%
                      </div>
                      <div class="expense-subtext">del prestito iniziale</div>
                    </div>
                    <div class="expense-card comparison-card">
                      <div class="expense-label">Moltiplicatore Costo</div>
                      <div class="expense-value">
                        ${this._calculateCostMultiplier().toFixed(3)}x
                      </div>
                      <div class="expense-subtext">rapporto al prestito</div>
                    </div>
                  </div>

                  ${(() => {
                    const input = this.mortgage.input
                    const hasSavings = input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0
                    const hasDeductions = input.detrazioniInteressi || (input.detrazioneRistrutturazione && input.detrazioneRistrutturazione > 0)

                    return hasSavings || hasDeductions
                      ? (() => {
                          const closure = this._calculateEarlyClosure()
                          return closure.isPossible
                            ? html`
                                <div class="early-closure-section">
                                  <h3>Chiusura Anticipata</h3>
                                  <div class="closure-summary">
                                    ${hasSavings ? html`<p><strong>Risparmi mensili:</strong> ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(input.risparmiMensiliForecast!)}</p>` : ''}
                                    ${input.detrazioniInteressi ? html`<p><strong>Detrazioni interessi:</strong> 19% annuale (max €4.000/anno)</p>` : ''}
                                    ${input.detrazioneRistrutturazione ? html`<p><strong>Detrazione ristrutturazione:</strong> 36% di €${new Intl.NumberFormat('it-IT').format(input.detrazioneRistrutturazione)} in 10 rate</p>` : ''}
                                  </div>
                                  <div class="closure-info">
                                    <div class="closure-card success">
                                      <div class="closure-label">Data Prevista di Chiusura</div>
                                      <div class="closure-value">
                                        ${this._getMonthName(closure.meseChiusura! % 12)} ${closure.annoChiusura}
                                      </div>
                                    </div>
                                    <div class="closure-card">
                                      <div class="closure-label">Mesi Risparmiati</div>
                                      <div class="closure-value">
                                        ${closure.mesiRisparmiati} mesi
                                      </div>
                                    </div>
                                    <div class="closure-card">
                                      <div class="closure-label">Risparmi Accumulati</div>
                                      <div class="closure-value">
                                        ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(closure.risparmiAccumulati!)}
                                      </div>
                                    </div>
                                    <div class="closure-card">
                                      <div class="closure-label">Capitale da Pagare</div>
                                      <div class="closure-value">
                                        ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(closure.capitalePagato!)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              `
                            : html`
                                <div class="early-closure-section">
                                  <h3>Chiusura Anticipata</h3>
                                  <div class="closure-summary">
                                    ${hasSavings ? html`<p><strong>Risparmi mensili:</strong> ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(input.risparmiMensiliForecast!)}</p>` : ''}
                                    ${input.detrazioniInteressi ? html`<p><strong>Detrazioni interessi:</strong> 19% annuale (max €4.000/anno)</p>` : ''}
                                    ${input.detrazioneRistrutturazione ? html`<p><strong>Detrazione ristrutturazione:</strong> 36% di €${new Intl.NumberFormat('it-IT').format(input.detrazioneRistrutturazione)} in 10 rate</p>` : ''}
                                  </div>
                                  <p class="closure-warning">
                                    Gli importi inseriti non sono sufficienti per estinguere il mutuo anticipatamente. Aumenta i risparmi mensili o l'importo della ristrutturazione.
                                  </p>
                                </div>
                              `
                        })()
                      : ''
                  })()}

                  <div class="table-section">
                    <h3>Piano di Ammortamento</h3>
                    <amortization-table .rows=${this.mortgage.amortization}></amortization-table>
                  </div>
                </div>
              `
            : html`<p class="no-data">Nessun dato disponibile</p>`}
      </div>
    `
  }

  private _getMonthName(mese: number): string {
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
    ]
    return months[mese] || ''
  }

  private _calculateTotalInterests(): number {
    if (!this.mortgage || this.mortgage.amortization.length === 0) return 0
    return this.mortgage.amortization[this.mortgage.amortization.length - 1].totaleIntaressPagato
  }

  private _calculateTotalOtherCosts(): number {
    if (!this.mortgage) return 0

    const input = this.mortgage.input
    let totalCosts = 0

    // Spese istruttoria
    if (input.speseIstruttoria.tipo === 'percentage') {
      totalCosts += (input.importoTotale * input.speseIstruttoria.valore) / 100
    } else {
      totalCosts += input.speseIstruttoria.valore
    }

    // Spese incasso rata (monthly fee * number of months)
    const numMonths = input.durataAnni * 12
    totalCosts += input.speseIncassoRata * numMonths

    // Spesa perizia
    totalCosts += input.spesaPerizia

    return totalCosts
  }

  private _calculateGrandTotal(): number {
    return this._calculateTotalInterests() + this._calculateTotalOtherCosts()
  }

  private _calculateEffectiveRate(): number {
    if (!this.mortgage) return 0
    const totalCost = this._calculateGrandTotal()
    const initialAmount = this.mortgage.input.importoTotale
    return (totalCost / initialAmount) * 100
  }

  private _calculateCostMultiplier(): number {
    if (!this.mortgage) return 0
    const totalCost = this._calculateGrandTotal()
    const initialAmount = this.mortgage.input.importoTotale
    return (initialAmount + totalCost) / initialAmount
  }

  private _calculateEarlyClosure(): EarlyClosureData {
    if (!this.mortgage) {
      return { isPossible: false }
    }

    const input = this.mortgage.input
    const hasSavings = input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0
    const hasDeductions = input.detrazioniInteressi || (input.detrazioneRistrutturazione && input.detrazioneRistrutturazione > 0)

    if (!hasSavings && !hasDeductions) {
      return { isPossible: false }
    }

    return MortgageCalculator.calculateEarlyClosure(
      this.mortgage.amortization,
      input.risparmiMensiliForecast || 0,
      input.detrazioniInteressi || false,
      input.detrazioneRistrutturazione || 0
    )
  }

  static styles = css`
    :host {
      display: block;
    }

    .mortgage-tab-container {
      padding: 1.5rem;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    h2 {
      margin: 0 0 1.5rem 0;
      font-size: 1.5rem;
      color: var(--gray-900);
    }

    h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      color: var(--gray-900);
      font-weight: 700;
    }

    .form-section {
      max-width: 600px;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--gray-200);
    }

    .results-header h2 {
      margin: 0;
    }

    .results-actions {
      display: flex;
      gap: 0.5rem;
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
      white-space: nowrap;
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

    .mortgage-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid var(--gray-200);
    }

    .summary-section {
      padding: 1rem;
      background: var(--gray-100);
      border-radius: 0.5rem;
    }

    .summary-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    dt {
      font-weight: 600;
      color: var(--gray-700);
      margin-top: 0.75rem;
      font-size: 0.9rem;
    }

    dt:first-child {
      margin-top: 0;
    }

    dd {
      margin: 0.25rem 0 0 0;
      font-size: 1rem;
      font-weight: 500;
      color: var(--primary);
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .expense-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
      padding: 1.5rem;
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      border-radius: 0.75rem;
      border: 2px solid var(--gray-200);
    }

    .expense-card {
      padding: 1.5rem;
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      text-align: center;
      border-left: 4px solid var(--primary);
    }

    .expense-card.grand-total {
      border-left-color: var(--success);
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%);
    }

    .expense-label {
      font-size: 0.9rem;
      color: var(--gray-700);
      font-weight: 600;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .expense-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .expense-card.grand-total .expense-value {
      color: var(--success);
      font-size: 1.75rem;
    }

    .expense-card.comparison-card {
      border-left-color: var(--primary);
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%);
    }

    .expense-subtext {
      font-size: 0.75rem;
      color: var(--gray-700);
      margin-top: 0.5rem;
      font-style: italic;
    }

    .table-section {
      margin-top: 2rem;
    }

    .early-closure-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: var(--gray-50);
      border-radius: 0.5rem;
      border: 2px solid var(--primary);
    }

    .early-closure-section h3 {
      margin-top: 0;
      color: var(--primary);
    }

    .closure-summary {
      padding: 1rem;
      background: var(--gray-50);
      border-radius: 0.5rem;
      border-left: 4px solid var(--primary);
      margin-bottom: 1rem;
    }

    .closure-summary p {
      margin: 0.5rem 0;
      font-size: 0.95rem;
      color: var(--gray-900);
    }

    .closure-summary p:first-child {
      margin-top: 0;
    }

    .closure-summary p:last-child {
      margin-bottom: 0;
    }

    .closure-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .closure-card {
      padding: 1rem;
      background: white;
      border-radius: 0.5rem;
      border-left: 4px solid var(--primary);
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .closure-card.success {
      border-left-color: var(--success);
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%);
    }

    .closure-label {
      font-size: 0.85rem;
      color: var(--gray-700);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }

    .closure-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--primary);
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .closure-card.success .closure-value {
      color: var(--success);
      font-size: 1.5rem;
    }

    .closure-warning {
      padding: 1rem;
      background: rgba(239, 68, 68, 0.1);
      border-left: 4px solid var(--danger);
      border-radius: 0.5rem;
      color: var(--danger);
      margin: 0;
      font-weight: 500;
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

      .btn-secondary,
      .btn-danger {
        flex: 1;
      }

      .mortgage-summary {
        grid-template-columns: 1fr;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'mortgage-tab': MortgageTab
  }
}
