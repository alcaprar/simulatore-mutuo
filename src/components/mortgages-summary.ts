import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MortgageData, AppTab, EarlyClosureData, VirtualMortgageData } from '../types.js';
import { StorageService } from '../storage.js';
import { MortgageCalculator } from '../utils/mortgage-calculator.js';
import { VirtualMortgageCalculator } from '../utils/virtual-mortgage-calculator.js';

interface MortgageSummaryRow {
  tab: AppTab;
  mortgage: MortgageData;
  totalInterests: number;
  totalOtherCosts: number;
  grandTotal: number;
}

interface VirtualMortgageSummaryRow {
  tab: AppTab;
  virtual: VirtualMortgageData;
  sourceMortgages: MortgageData[];
  totalAmount: number;
  totalInterests: number;
  totalOtherCosts: number;
  grandTotal: number;
}

@customElement('mortgages-summary')
export class MortgagesSummary extends LitElement {
  @property({ type: Array })
  tabs: AppTab[] = [];

  @state()
  private mortgageRows: MortgageSummaryRow[] = [];

  @state()
  private virtualMortgageRows: VirtualMortgageSummaryRow[] = [];

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('tabs')) {
      this.loadMortgages();
    }
  }

  private loadMortgages(): void {
    const rows: MortgageSummaryRow[] = [];
    const virtualRows: VirtualMortgageSummaryRow[] = [];

    for (const tab of this.tabs) {
      // Skip fixed tabs
      if (tab.isFixed) continue;

      // Load regular mortgages
      if (!tab.isVirtual) {
        const mortgage = StorageService.getMortgage(tab.id);
        if (mortgage) {
          const totalInterests = this._calculateTotalInterests(mortgage);
          const totalOtherCosts = this._calculateTotalOtherCosts(mortgage);
          const grandTotal = totalInterests + totalOtherCosts;

          rows.push({
            tab,
            mortgage,
            totalInterests,
            totalOtherCosts,
            grandTotal,
          });
        }
      } else {
        // Load virtual mortgages
        const virtual = StorageService.getVirtualMortgage(tab.id);
        if (virtual) {
          const sourceMortgages = StorageService.getSourceMortgages(virtual.sourceIds);
          if (sourceMortgages.length > 0) {
            const totalAmount = VirtualMortgageCalculator.calculateTotalAmount(sourceMortgages);
            const totalInterests =
              VirtualMortgageCalculator.calculateTotalInterest(sourceMortgages);
            const totalOtherCosts = VirtualMortgageCalculator.calculateTotalFees(sourceMortgages);
            const grandTotal = totalInterests + totalOtherCosts;

            virtualRows.push({
              tab,
              virtual,
              sourceMortgages,
              totalAmount,
              totalInterests,
              totalOtherCosts,
              grandTotal,
            });
          }
        }
      }
    }

    this.mortgageRows = rows;
    this.virtualMortgageRows = virtualRows;
  }

  private _calculateTotalInterests(mortgage: MortgageData): number {
    if (mortgage.amortization.length === 0) return 0;
    return mortgage.amortization[mortgage.amortization.length - 1].totaleIntaressPagato;
  }

  private _calculateTotalOtherCosts(mortgage: MortgageData): number {
    const input = mortgage.input;
    let totalCosts = 0;

    // Spese istruttoria
    if (input.speseIstruttoria.tipo === 'percentage') {
      totalCosts += (input.importoTotale * input.speseIstruttoria.valore) / 100;
    } else {
      totalCosts += input.speseIstruttoria.valore;
    }

    // Spese incasso rata
    const numMonths = input.durataAnni * 12;
    totalCosts += input.speseIncassoRata * numMonths;

    // Spesa perizia
    totalCosts += input.spesaPerizia;

    // Assicurazione Incendio, Scoppio
    if (input.assicurazioneIncendio) {
      if (input.assicurazioneIncendio.tipo === 'onetime') {
        totalCosts += input.assicurazioneIncendio.valore;
      } else {
        totalCosts += input.assicurazioneIncendio.valore * numMonths;
      }
    }

    // Assicurazione Aggiuntiva
    if (input.assicurazioneAggiuntiva) {
      if (input.assicurazioneAggiuntiva.tipo === 'onetime') {
        totalCosts += input.assicurazioneAggiuntiva.valore;
      } else {
        totalCosts += input.assicurazioneAggiuntiva.valore * numMonths;
      }
    }

    return totalCosts;
  }

  private _calculateEffectiveRate(mortgage: MortgageData): number {
    const totalInterests = this._calculateTotalInterests(mortgage);
    const totalOtherCosts = this._calculateTotalOtherCosts(mortgage);
    const totalCost = totalInterests + totalOtherCosts;
    const initialAmount = mortgage.input.importoTotale;
    return (totalCost / initialAmount) * 100;
  }

  private _calculateCostMultiplier(mortgage: MortgageData): number {
    const totalInterests = this._calculateTotalInterests(mortgage);
    const totalOtherCosts = this._calculateTotalOtherCosts(mortgage);
    const totalCost = totalInterests + totalOtherCosts;
    const initialAmount = mortgage.input.importoTotale;
    return (initialAmount + totalCost) / initialAmount;
  }

  private _formatCurrency(value: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
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
    ];
    return months[mese] || '';
  }

  private _calculateEndDate(
    startMonth: number,
    startYear: number,
    durationYears: number
  ): { month: number; year: number } {
    let endMonth = startMonth + durationYears * 12;
    let endYear = startYear;

    endYear += Math.floor(endMonth / 12);
    endMonth = endMonth % 12;

    return { month: endMonth, year: endYear };
  }

  private _getVirtualMortgageEndDate(sourceMortgages: MortgageData[]): {
    month: number;
    year: number;
  } {
    let latestMonth = 0;
    let latestYear = 0;

    for (const mortgage of sourceMortgages) {
      const endDate = this._calculateEndDate(
        mortgage.input.mesePartenza,
        mortgage.input.annoPartenza,
        mortgage.input.durataAnni
      );

      if (
        endDate.year > latestYear ||
        (endDate.year === latestYear && endDate.month > latestMonth)
      ) {
        latestYear = endDate.year;
        latestMonth = endDate.month;
      }
    }

    return { month: latestMonth, year: latestYear };
  }

  private _getVirtualMortgageEarlyClosure(sourceMortgages: MortgageData[]): EarlyClosureData {
    // Virtual mortgage can only close early if ALL source mortgages can close early
    // Otherwise, payments continue on mortgages that don't have early closure capability
    let latestClosure: EarlyClosureData = { isPossible: false };
    let allCanClose = true;

    for (const mortgage of sourceMortgages) {
      const closure = this._calculateEarlyClosure(mortgage);

      if (!closure.isPossible) {
        // At least one mortgage can't close early
        allCanClose = false;
        break;
      }

      if (closure.isPossible && closure.annoChiusura) {
        // Find the latest closure date
        if (
          !latestClosure.isPossible ||
          !latestClosure.annoChiusura ||
          closure.annoChiusura > latestClosure.annoChiusura ||
          (closure.annoChiusura === latestClosure.annoChiusura &&
            (closure.meseChiusura || 0) > (latestClosure.meseChiusura || 0))
        ) {
          latestClosure = closure;
        }
      }
    }

    // Only return early closure if ALL mortgages can close early
    return allCanClose ? latestClosure : { isPossible: false };
  }

  private _calculateEarlyClosure(mortgage: MortgageData): EarlyClosureData {
    const input = mortgage.input;
    const hasSavings = input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0;
    const hasDeductions =
      input.detrazioniInteressi ||
      (input.detrazioneRistrutturazione && input.detrazioneRistrutturazione > 0);

    if (!hasSavings && !hasDeductions) {
      return { isPossible: false };
    }

    // Use the amortization schedule data directly for consistency with the table display
    return MortgageCalculator.calculateEarlyClosureFromSchedule(mortgage.amortization);
  }

  private _calculateInterestSaved(mortgage: MortgageData, closure: EarlyClosureData): number {
    if (!closure.isPossible || !closure.meseChiusura) {
      return 0;
    }

    const totalInterest = this._calculateTotalInterests(mortgage);
    const closureRow = mortgage.amortization[closure.meseChiusura - 1];

    if (!closureRow) {
      return 0;
    }

    return totalInterest - closureRow.totaleIntaressPagato;
  }

  render() {
    if (this.mortgageRows.length === 0 && this.virtualMortgageRows.length === 0) {
      return html`
        <div class="no-mortgages">
          <p>Nessun mutuo simulato. Crea una nuova scheda per iniziare.</p>
        </div>
      `;
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
                  <th>Fine</th>
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
                      <td>
                        ${(() => {
                          const endDate = this._calculateEndDate(
                            row.mortgage.input.mesePartenza,
                            row.mortgage.input.annoPartenza,
                            row.mortgage.input.durataAnni
                          );
                          return html`${this._getMonthName(endDate.month)} ${endDate.year}`;
                        })()}
                      </td>
                      <td class="early-closure-date">
                        ${(() => {
                          const input = row.mortgage.input;
                          const hasSavings =
                            input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0;
                          const hasDeductions =
                            input.detrazioniInteressi ||
                            (input.detrazioneRistrutturazione &&
                              input.detrazioneRistrutturazione > 0);

                          if (hasSavings || hasDeductions) {
                            const closure = this._calculateEarlyClosure(row.mortgage);
                            return closure.isPossible
                              ? html`<span class="closure-date-value"
                                  >${this._getMonthName(closure.meseChiusura! % 12)}
                                  ${closure.annoChiusura}</span
                                >`
                              : html`<span class="closure-not-feasible">Non fattibile</span>`;
                          }
                          return html`<span class="closure-not-planned">Non prevista</span>`;
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
                ${this.virtualMortgageRows.map(
                  (row, idx) => html`
                    <tr
                      class="virtual-mortgage-row ${(this.mortgageRows.length + idx) % 2 === 0
                        ? 'even'
                        : 'odd'}"
                    >
                      <td class="bank-name">
                        <a href="#${row.tab.id}" class="tab-link">
                          ${row.tab.name}
                          <span class="virtual-badge">Virtuale</span>
                        </a>
                      </td>
                      <td class="currency">${this._formatCurrency(row.totalAmount)}</td>
                      <td colspan="2">
                        <span class="virtual-note">Multipli mutui</span>
                      </td>
                      <td>
                        ${(() => {
                          const startDate = (() => {
                            let earliestMonth = 11;
                            let earliestYear = 9999;
                            for (const m of row.sourceMortgages) {
                              if (
                                m.input.annoPartenza < earliestYear ||
                                (m.input.annoPartenza === earliestYear &&
                                  m.input.mesePartenza < earliestMonth)
                              ) {
                                earliestYear = m.input.annoPartenza;
                                earliestMonth = m.input.mesePartenza;
                              }
                            }
                            return { month: earliestMonth, year: earliestYear };
                          })();
                          return html`${this._getMonthName(startDate.month)} ${startDate.year}`;
                        })()}
                      </td>
                      <td>
                        ${(() => {
                          const endDate = this._getVirtualMortgageEndDate(row.sourceMortgages);
                          return html`${this._getMonthName(endDate.month)} ${endDate.year}`;
                        })()}
                      </td>
                      <td class="early-closure-date">
                        ${(() => {
                          const closure = this._getVirtualMortgageEarlyClosure(row.sourceMortgages);
                          return closure.isPossible
                            ? html`<span class="closure-date-value"
                                >${this._getMonthName(closure.meseChiusura! % 12)}
                                ${closure.annoChiusura}</span
                              >`
                            : html`<span class="closure-not-feasible">Non fattibile</span>`;
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
                        ${((row.grandTotal / row.totalAmount) * 100).toFixed(2)}%
                      </td>
                      <td class="currency comparison-value">
                        ${((row.totalAmount + row.grandTotal) / row.totalAmount).toFixed(3)}x
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

          ${this.virtualMortgageRows.length > 0
            ? html` <h3 class="virtual-section-title">Mutui Virtuali</h3> `
            : ''}
          ${this.virtualMortgageRows.map(
            (row) => html`
              <div class="mortgage-detail-card virtual-detail-card">
                <div class="detail-header">
                  <h3>
                    ${row.tab.name}
                    <span class="virtual-badge">Virtuale</span>
                  </h3>
                  <a href="#${row.tab.id}" class="view-btn">Visualizza →</a>
                </div>

                <div class="detail-content">
                  <div class="detail-section">
                    <h4>Mutui Combinati</h4>
                    <ul class="source-mortgages-list">
                      ${row.sourceMortgages.map(
                        (m) => html`
                          <li>
                            <strong>${m.nome}</strong><br />
                            ${this._formatCurrency(m.input.importoTotale)} @
                            ${m.input.tassoInteresse.toFixed(2)}%
                          </li>
                        `
                      )}
                    </ul>
                  </div>

                  <div class="detail-section">
                    <h4>Parametri Combinati</h4>
                    <dl class="detail-list">
                      <dt>Importo Totale:</dt>
                      <dd>${this._formatCurrency(row.totalAmount)}</dd>

                      <dt>Tassi Diversi:</dt>
                      <dd class="virtual-note">
                        ${row.sourceMortgages
                          .map((m) => m.input.tassoInteresse.toFixed(2) + '%')
                          .join(', ')}
                      </dd>

                      <dt>Periodi Diversi:</dt>
                      <dd class="virtual-note">Vedi dettagli sulla scheda</dd>

                      <dt>Data Inizio (Earliest):</dt>
                      <dd>
                        ${(() => {
                          let earliestMonth = 11;
                          let earliestYear = 9999;
                          for (const m of row.sourceMortgages) {
                            if (
                              m.input.annoPartenza < earliestYear ||
                              (m.input.annoPartenza === earliestYear &&
                                m.input.mesePartenza < earliestMonth)
                            ) {
                              earliestYear = m.input.annoPartenza;
                              earliestMonth = m.input.mesePartenza;
                            }
                          }
                          return html`${this._getMonthName(earliestMonth)} ${earliestYear}`;
                        })()}
                      </dd>

                      <dt>Data Fine (Latest):</dt>
                      <dd>
                        ${(() => {
                          const endDate = this._getVirtualMortgageEndDate(row.sourceMortgages);
                          return html`${this._getMonthName(endDate.month)} ${endDate.year}`;
                        })()}
                      </dd>
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
                      <dd class="highlight-costs">${this._formatCurrency(row.totalOtherCosts)}</dd>

                      <dt>Costo Totale:</dt>
                      <dd class="grand-total-value">${this._formatCurrency(row.grandTotal)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            `
          )}
          ${this.mortgageRows.length > 0
            ? html` <h3 class="regular-section-title">Mutui Singoli</h3> `
            : ''}
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
                      <dd>
                        ${row.mortgage.input.durataAnni} anni (${row.mortgage.input.durataAnni * 12}
                        mesi)
                      </dd>

                      <dt>Tasso Interesse:</dt>
                      <dd>${row.mortgage.input.tassoInteresse.toFixed(2)}% annuale</dd>

                      <dt>Data Inizio:</dt>
                      <dd>
                        ${this._getMonthName(row.mortgage.input.mesePartenza)}
                        ${row.mortgage.input.annoPartenza}
                      </dd>

                      <dt>Data Fine:</dt>
                      <dd>
                        ${(() => {
                          const endDate = this._calculateEndDate(
                            row.mortgage.input.mesePartenza,
                            row.mortgage.input.annoPartenza,
                            row.mortgage.input.durataAnni
                          );
                          return html`${this._getMonthName(endDate.month)} ${endDate.year}`;
                        })()}
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

                      ${row.mortgage.input.assicurazioneIncendio
                        ? html`
                            <dt>Assicurazione Incendio:</dt>
                            <dd>
                              ${this._formatCurrency(
                                row.mortgage.input.assicurazioneIncendio.valore
                              )}
                              ${row.mortgage.input.assicurazioneIncendio.tipo === 'onetime'
                                ? '(una tantum)'
                                : '/mese'}
                            </dd>
                          `
                        : ''}
                      ${row.mortgage.input.assicurazioneAggiuntiva
                        ? html`
                            <dt>Assicurazione Aggiuntiva:</dt>
                            <dd>
                              ${this._formatCurrency(
                                row.mortgage.input.assicurazioneAggiuntiva.valore
                              )}
                              ${row.mortgage.input.assicurazioneAggiuntiva.tipo === 'onetime'
                                ? '(una tantum)'
                                : '/mese'}
                            </dd>
                          `
                        : ''}
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
                      <dd class="highlight-costs">${this._formatCurrency(row.totalOtherCosts)}</dd>

                      <dt>Costo Totale:</dt>
                      <dd class="grand-total-value">${this._formatCurrency(row.grandTotal)}</dd>
                    </dl>
                  </div>

                  ${(() => {
                    const input = row.mortgage.input;
                    const hasSavings =
                      input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0;
                    const hasDeductions =
                      input.detrazioniInteressi ||
                      (input.detrazioneRistrutturazione && input.detrazioneRistrutturazione > 0);

                    return hasSavings || hasDeductions
                      ? (() => {
                          const closure = this._calculateEarlyClosure(row.mortgage);
                          const interestSaved = this._calculateInterestSaved(row.mortgage, closure);
                          return html`
                            <div class="detail-section early-closure-section">
                              <h4>Chiusura Anticipata</h4>
                              ${closure.isPossible
                                ? html`
                                    <dl class="detail-list">
                                      ${hasSavings
                                        ? html`<dt>Risparmi mensili:</dt>
                                            <dd>
                                              ${this._formatCurrency(
                                                input.risparmiMensiliForecast!
                                              )}
                                            </dd>`
                                        : ''}
                                      ${input.detrazioniInteressi
                                        ? html`<dt>Detrazioni interessi:</dt>
                                            <dd>19% annuale (max €760/anno)</dd>`
                                        : ''}
                                      ${input.detrazioneRistrutturazione
                                        ? html`<dt>Detrazione ristrutturazione:</dt>
                                            <dd>36% in 10 rate</dd>`
                                        : ''}
                                      <dt class="closure-success">Data Chiusura:</dt>
                                      <dd class="closure-success">
                                        ${this._getMonthName(closure.meseChiusura! % 12)}
                                        ${closure.annoChiusura}
                                      </dd>
                                      <dt>Mesi Risparmiati:</dt>
                                      <dd>${closure.mesiRisparmiati} mesi</dd>
                                      <dt class="interest-saved-label">Interessi Risparmiati:</dt>
                                      <dd class="interest-saved">
                                        ${this._formatCurrency(interestSaved)}
                                      </dd>
                                      <dt>Risparmi Accumulati:</dt>
                                      <dd>${this._formatCurrency(closure.risparmiAccumulati!)}</dd>
                                    </dl>
                                  `
                                : html`
                                    <p class="closure-not-possible">
                                      ${hasSavings
                                        ? `I risparmi mensili di ${this._formatCurrency(input.risparmiMensiliForecast!)} `
                                        : ''}
                                      ${hasDeductions ? `e le detrazioni ` : ''} non sono
                                      sufficienti per chiudere il mutuo anticipatamente.
                                    </p>
                                  `}
                            </div>
                          `;
                        })()
                      : '';
                  })()}
                </div>
              </div>
            `
          )}
        </div>
      </div>
    `;
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
      background: linear-gradient(
        135deg,
        rgba(59, 130, 246, 0.05) 0%,
        rgba(59, 130, 246, 0.02) 100%
      ) !important;
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

    /* Virtual Mortgage Styles */
    .virtual-mortgage-row {
      background: linear-gradient(
        135deg,
        rgba(168, 85, 247, 0.03) 0%,
        rgba(168, 85, 247, 0.01) 100%
      );
    }

    .virtual-mortgage-row:hover {
      background: linear-gradient(
        135deg,
        rgba(168, 85, 247, 0.08) 0%,
        rgba(168, 85, 247, 0.05) 100%
      );
    }

    .virtual-badge {
      display: inline-block;
      background: var(--secondary, #a855f7);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      margin-left: 0.75rem;
      text-decoration: none;
    }

    .virtual-note {
      color: var(--gray-600);
      font-style: italic;
      font-family: inherit;
    }

    .closure-not-applicable {
      color: var(--gray-500);
      font-weight: 500;
      padding: 0.25rem 0.5rem;
      background: var(--gray-100);
      border-radius: 0.25rem;
      display: inline-block;
    }

    .virtual-detail-card {
      border-left: 4px solid var(--secondary, #a855f7);
      background: linear-gradient(
        135deg,
        rgba(168, 85, 247, 0.05) 0%,
        rgba(168, 85, 247, 0.02) 100%
      );
    }

    .virtual-section-title {
      margin-top: 2rem;
      margin-bottom: 1.5rem;
      font-size: 1.25rem;
      color: var(--secondary, #a855f7);
      border-bottom: 2px solid var(--secondary, #a855f7);
      padding-bottom: 0.75rem;
    }

    .regular-section-title {
      margin-top: 2rem;
      margin-bottom: 1.5rem;
      font-size: 1.25rem;
      color: var(--primary);
      border-bottom: 2px solid var(--primary);
      padding-bottom: 0.75rem;
    }

    .source-mortgages-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .source-mortgages-list li {
      padding: 0.75rem;
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: 0.375rem;
      font-size: 0.9rem;
    }

    .source-mortgages-list li strong {
      display: block;
      margin-bottom: 0.5rem;
      color: var(--gray-900);
    }

    .source-mortgages-list li br {
      margin-bottom: 0.25rem;
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
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'mortgages-summary': MortgagesSummary;
  }
}
