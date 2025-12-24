import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { MortgageData, AppTab, EarlyClosureData } from '../types.js'
import { StorageService } from '../storage.js'
import { MortgageCalculator } from '../utils/mortgage-calculator.js'

interface MortgageSummaryRow {
  tab: AppTab
  mortgage: MortgageData
  totalInterests: number
  totalOtherCosts: number
  grandTotal: number
}

@customElement('mortgages-summary')
export class MortgagesSummary extends LitElement {
  @property({ type: Array })
  tabs: AppTab[] = []

  @state()
  private mortgageRows: MortgageSummaryRow[] = []

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('tabs')) {
      this.loadMortgages()
    }
  }

  private loadMortgages(): void {
    const rows: MortgageSummaryRow[] = []

    for (const tab of this.tabs) {
      // Skip fixed tabs
      if (tab.isFixed) continue

      const mortgage = StorageService.getMortgage(tab.id)
      if (mortgage) {
        const totalInterests = this._calculateTotalInterests(mortgage)
        const totalOtherCosts = this._calculateTotalOtherCosts(mortgage)
        const grandTotal = totalInterests + totalOtherCosts

        rows.push({
          tab,
          mortgage,
          totalInterests,
          totalOtherCosts,
          grandTotal,
        })
      }
    }

    this.mortgageRows = rows
  }

  private _calculateTotalInterests(mortgage: MortgageData): number {
    if (mortgage.amortization.length === 0) return 0
    return mortgage.amortization[mortgage.amortization.length - 1].totaleIntaressPagato
  }

  private _calculateTotalOtherCosts(mortgage: MortgageData): number {
    const input = mortgage.input
    let totalCosts = 0

    // Spese istruttoria
    if (input.speseIstruttoria.tipo === 'percentage') {
      totalCosts += (input.importoTotale * input.speseIstruttoria.valore) / 100
    } else {
      totalCosts += input.speseIstruttoria.valore
    }

    // Spese incasso rata
    const numMonths = input.durataAnni * 12
    totalCosts += input.speseIncassoRata * numMonths

    // Spesa perizia
    totalCosts += input.spesaPerizia

    return totalCosts
  }

  private _calculateEffectiveRate(mortgage: MortgageData): number {
    const totalInterests = this._calculateTotalInterests(mortgage)
    const totalOtherCosts = this._calculateTotalOtherCosts(mortgage)
    const totalCost = totalInterests + totalOtherCosts
    const initialAmount = mortgage.input.importoTotale
    return (totalCost / initialAmount) * 100
  }

  private _calculateCostMultiplier(mortgage: MortgageData): number {
    const totalInterests = this._calculateTotalInterests(mortgage)
    const totalOtherCosts = this._calculateTotalOtherCosts(mortgage)
    const totalCost = totalInterests + totalOtherCosts
    const initialAmount = mortgage.input.importoTotale
    return (initialAmount + totalCost) / initialAmount
  }

  private _formatCurrency(value: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
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

  private _calculateEarlyClosure(mortgage: MortgageData): EarlyClosureData {
    const input = mortgage.input
    const hasSavings = input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0
    const hasDeductions = input.detrazioniInteressi || (input.detrazioneRistrutturazione && input.detrazioneRistrutturazione > 0)

    if (!hasSavings && !hasDeductions) {
      return { isPossible: false }
    }

    return MortgageCalculator.calculateEarlyClosure(
      mortgage.amortization,
      input.risparmiMensiliForecast || 0,
      input.detrazioniInteressi || false,
      input.detrazioneRistrutturazione || 0
    )
  }

  private _calculateInterestSaved(mortgage: MortgageData, closure: EarlyClosureData): number {
    if (!closure.isPossible || !closure.meseChiusura) {
      return 0
    }

    const totalInterest = this._calculateTotalInterests(mortgage)
    const closureRow = mortgage.amortization[closure.meseChiusura - 1]

    if (!closureRow) {
      return 0
    }

    return totalInterest - closureRow.totaleIntaressPagato
  }

  render() {
    if (this.mortgageRows.length === 0) {
      return html`
        <div class="no-mortgages">
          <p>Nessun mutuo simulato. Crea una nuova scheda per iniziare.</p>
        </div>
      `
    }

    return html`
      <div class="summary-container">
        <div class="mortgages-table-section">
          <h2>Dettagli Mutui</h2>
          <div class="table-wrapper">
            <table class="mortgages-table">
              <thead>
                <tr>
                  <th>Banca</th>
                  <th>Importo</th>
                  <th>Durata</th>
                  <th>Tasso</th>
                  <th>Inizio</th>
                  <th>Chiusura Anticipata</th>
                  <th>Tot. Interessi</th>
                  <th>Tot. Altre Spese</th>
                  <th>Costo Totale</th>
                  <th>Costo Effettivo</th>
                  <th>Moltiplicatore</th>
                </tr>
              </thead>
              <tbody>
                ${this.mortgageRows.map(
                  (row, idx) => html`
                    <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
                      <td class="bank-name">
                        <a href="#${row.tab.id}" class="tab-link">${row.tab.name}</a>
                      </td>
                      <td class="currency">
                        ${this._formatCurrency(row.mortgage.input.importoTotale)}
                      </td>
                      <td>${row.mortgage.input.durataAnni} anni</td>
                      <td>${row.mortgage.input.tassoInteresse.toFixed(2)}%</td>
                      <td>
                        ${this._getMonthName(row.mortgage.input.mesePartenza)}
                        ${row.mortgage.input.annoPartenza}
                      </td>
                      <td class="early-closure-date">
                        ${(() => {
                          const input = row.mortgage.input
                          const hasSavings = input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0
                          const hasDeductions = input.detrazioniInteressi || (input.detrazioneRistrutturazione && input.detrazioneRistrutturazione > 0)

                          if (hasSavings || hasDeductions) {
                            const closure = this._calculateEarlyClosure(row.mortgage)
                            return closure.isPossible
                              ? html`<span class="closure-date-value">${this._getMonthName(closure.meseChiusura! % 12)} ${closure.annoChiusura}</span>`
                              : html`<span class="closure-not-feasible">Non fattibile</span>`
                          }
                          return html`<span class="closure-not-planned">Non prevista</span>`
                        })()}
                      </td>
                      <td class="currency highlight-interest">
                        ${this._formatCurrency(row.totalInterests)}
                      </td>
                      <td class="currency highlight-costs">
                        ${this._formatCurrency(row.totalOtherCosts)}
                      </td>
                      <td class="currency grand-total-value">
                        ${this._formatCurrency(row.grandTotal)}
                      </td>
                      <td class="currency comparison-value">
                        ${this._calculateEffectiveRate(row.mortgage).toFixed(2)}%
                      </td>
                      <td class="currency comparison-value">
                        ${this._calculateCostMultiplier(row.mortgage).toFixed(3)}x
                      </td>
                    </tr>
                  `
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div class="detailed-breakdown">
          <h2>Dettagli per Mutuo</h2>
          ${this.mortgageRows.map(
            (row) => html`
              <div class="mortgage-detail-card">
                <div class="detail-header">
                  <h3>${row.tab.name}</h3>
                  <a href="#${row.tab.id}" class="view-btn">Visualizza →</a>
                </div>

                <div class="detail-content">
                  <div class="detail-section">
                    <h4>Parametri Mutuo</h4>
                    <dl class="detail-list">
                      <dt>Importo:</dt>
                      <dd>${this._formatCurrency(row.mortgage.input.importoTotale)}</dd>

                      <dt>Durata:</dt>
                      <dd>${row.mortgage.input.durataAnni} anni (${row.mortgage.input.durataAnni * 12} mesi)</dd>

                      <dt>Tasso Interesse:</dt>
                      <dd>${row.mortgage.input.tassoInteresse.toFixed(2)}% annuale</dd>

                      <dt>Data Inizio:</dt>
                      <dd>
                        ${this._getMonthName(row.mortgage.input.mesePartenza)}
                        ${row.mortgage.input.annoPartenza}
                      </dd>
                    </dl>
                  </div>

                  <div class="detail-section">
                    <h4>Spese</h4>
                    <dl class="detail-list">
                      <dt>Istruttoria:</dt>
                      <dd>
                        ${row.mortgage.input.speseIstruttoria.tipo === 'percentage'
                          ? `${row.mortgage.input.speseIstruttoria.valore.toFixed(2)}%`
                          : this._formatCurrency(row.mortgage.input.speseIstruttoria.valore)}
                      </dd>

                      <dt>Incasso Rata:</dt>
                      <dd>${this._formatCurrency(row.mortgage.input.speseIncassoRata)}/mese</dd>

                      <dt>Perizia:</dt>
                      <dd>${this._formatCurrency(row.mortgage.input.spesaPerizia)}</dd>
                    </dl>
                  </div>

                  <div class="detail-section">
                    <h4>Costi Totali</h4>
                    <dl class="detail-list highlight-section">
                      <dt>Totale Interessi:</dt>
                      <dd class="highlight-interest">
                        ${this._formatCurrency(row.totalInterests)}
                      </dd>

                      <dt>Totale Altre Spese:</dt>
                      <dd class="highlight-costs">
                        ${this._formatCurrency(row.totalOtherCosts)}
                      </dd>

                      <dt>Costo Totale:</dt>
                      <dd class="grand-total-value">
                        ${this._formatCurrency(row.grandTotal)}
                      </dd>
                    </dl>
                  </div>

                  ${(() => {
                    const input = row.mortgage.input
                    const hasSavings = input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0
                    const hasDeductions = input.detrazioniInteressi || (input.detrazioneRistrutturazione && input.detrazioneRistrutturazione > 0)

                    return hasSavings || hasDeductions
                      ? (() => {
                          const closure = this._calculateEarlyClosure(row.mortgage)
                          const interestSaved = this._calculateInterestSaved(row.mortgage, closure)
                          return html`
                            <div class="detail-section early-closure-section">
                              <h4>Chiusura Anticipata</h4>
                              ${closure.isPossible
                                ? html`
                                    <dl class="detail-list">
                                      ${hasSavings ? html`<dt>Risparmi mensili:</dt><dd>${this._formatCurrency(input.risparmiMensiliForecast!)}</dd>` : ''}
                                      ${input.detrazioniInteressi ? html`<dt>Detrazioni interessi:</dt><dd>19% annuale (max €4.000/anno)</dd>` : ''}
                                      ${input.detrazioneRistrutturazione ? html`<dt>Detrazione ristrutturazione:</dt><dd>36% in 10 rate</dd>` : ''}
                                      <dt class="closure-success">Data Chiusura:</dt>
                                      <dd class="closure-success">${this._getMonthName(closure.meseChiusura! % 12)} ${closure.annoChiusura}</dd>
                                      <dt>Mesi Risparmiati:</dt>
                                      <dd>${closure.mesiRisparmiati} mesi</dd>
                                      <dt class="interest-saved-label">Interessi Risparmiati:</dt>
                                      <dd class="interest-saved">${this._formatCurrency(interestSaved)}</dd>
                                      <dt>Risparmi Accumulati:</dt>
                                      <dd>${this._formatCurrency(closure.risparmiAccumulati!)}</dd>
                                    </dl>
                                  `
                                : html`
                                    <p class="closure-not-possible">
                                      ${hasSavings ? `I risparmi mensili di ${this._formatCurrency(input.risparmiMensiliForecast!)} ` : ''}
                                      ${hasDeductions ? `e le detrazioni ` : ''}
                                      non sono sufficienti per chiudere il mutuo anticipatamente.
                                    </p>
                                  `
                              }
                            </div>
                          `
                        })()
                      : ''
                  })()}
                </div>
              </div>
            `
          )}
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
    }

    .summary-container {
      padding: 1.5rem;
      background: white;
      border-radius: 0.5rem;
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
    }

    h4 {
      margin: 0 0 0.75rem 0;
      font-size: 1rem;
      color: var(--gray-900);
      font-weight: 700;
    }

    .no-mortgages {
      padding: 3rem 1.5rem;
      text-align: center;
      color: var(--gray-700);
    }

    .no-mortgages p {
      margin: 0;
      font-size: 1.1rem;
    }

    /* Table Section */
    .mortgages-table-section {
      margin-bottom: 3rem;
    }

    .table-wrapper {
      overflow-x: auto;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .mortgages-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }

    th {
      background: var(--primary);
      color: white;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--gray-200);
      font-size: 0.9rem;
    }

    tr.even {
      background: #f9fafb;
    }

    tr.odd {
      background: white;
    }

    tbody tr:hover {
      background: #f3f4f6;
    }

    .bank-name {
      font-weight: 600;
      color: var(--gray-900);
    }

    .tab-link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }

    .tab-link:hover {
      color: #2563eb;
      text-decoration: underline;
    }

    .currency {
      font-family: 'Monaco', 'Courier New', monospace;
      text-align: right;
    }

    .grand-total-value {
      color: var(--success);
      font-weight: 600;
    }

    .comparison-value {
      color: var(--primary);
      font-weight: 600;
      background: rgba(59, 130, 246, 0.05);
    }

    .early-closure-date {
      text-align: center;
      font-weight: 600;
    }

    .closure-date-value {
      color: var(--success);
      font-weight: 700;
      background: rgba(16, 185, 129, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      display: inline-block;
      white-space: nowrap;
    }

    .closure-not-feasible {
      color: var(--danger);
      font-weight: 600;
      background: rgba(239, 68, 68, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      display: inline-block;
    }

    .closure-not-planned {
      color: var(--gray-700);
      font-weight: 500;
      padding: 0.25rem 0.5rem;
    }

    .totals-row {
      background: var(--gray-100);
      border-top: 2px solid var(--gray-200);
      border-bottom: 2px solid var(--gray-200);
    }

    .totals-row td {
      padding: 1rem 0.75rem;
      font-weight: 600;
    }

    /* Detailed Breakdown */
    .detailed-breakdown {
      margin-top: 2rem;
    }

    .mortgage-detail-card {
      margin-bottom: 1.5rem;
      padding: 1.5rem;
      background: var(--gray-50);
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--gray-200);
    }

    .detail-header h3 {
      margin: 0;
    }

    .view-btn {
      padding: 0.5rem 1rem;
      background: var(--primary);
      color: white;
      border-radius: 0.5rem;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      transition: background 0.2s;
    }

    .view-btn:hover {
      background: #2563eb;
    }

    .detail-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }

    .detail-section {
      padding: 1rem;
      background: white;
      border-radius: 0.5rem;
    }

    .detail-list {
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

    .highlight-section dd {
      font-size: 1.1rem;
      font-weight: 700;
    }

    .early-closure-section {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%) !important;
      border: 2px solid var(--primary) !important;
      border-left: 4px solid var(--primary) !important;
    }

    .early-closure-section h4 {
      color: var(--primary);
    }

    .closure-success {
      color: var(--success) !important;
      font-weight: 700 !important;
    }

    .closure-success.closure-success {
      color: var(--success) !important;
    }

    dd.closure-success {
      color: var(--success) !important;
      font-weight: 700 !important;
      font-size: 1.1rem;
    }

    .interest-saved-label {
      color: var(--success) !important;
      font-weight: 700 !important;
    }

    .interest-saved {
      color: var(--success) !important;
      font-weight: 700 !important;
      font-size: 1.1rem !important;
      background: rgba(16, 185, 129, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      display: inline-block;
    }

    .closure-not-possible {
      color: var(--danger);
      background: rgba(239, 68, 68, 0.1);
      padding: 0.75rem;
      border-radius: 0.25rem;
      border-left: 4px solid var(--danger);
      margin: 0;
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      .summary-cards {
        grid-template-columns: 1fr;
      }

      .summary-card.grand-total-card {
        grid-column: 1;
      }

      th,
      td {
        padding: 0.5rem;
        font-size: 0.8rem;
      }

      th {
        font-size: 0.75rem;
      }

      .detail-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .view-btn {
        width: 100%;
        text-align: center;
      }

      .detail-content {
        grid-template-columns: 1fr;
      }
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'mortgages-summary': MortgagesSummary
  }
}
