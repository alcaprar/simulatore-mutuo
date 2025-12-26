import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AmortizationRow } from '../types.js';
import { MortgageCalculator } from '../utils/mortgage-calculator.js';

@customElement('amortization-table')
export class AmortizationTable extends LitElement {
  @property({ type: Array })
  rows: AmortizationRow[] = [];

  @state()
  private currentPage: number = 0;

  @state()
  private pageSize: number = 12; // Show 12 months (1 year) per page by default

  private readonly pageSizeOptions = [12, 24, 36, 48, 60, 72]; // Multiples of 12 (years)

  private handlePreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.requestUpdate();
    }
  }

  private handleNextPage(): void {
    const maxPage = Math.ceil(this.rows.length / this.pageSize) - 1;
    if (this.currentPage < maxPage) {
      this.currentPage++;
      this.requestUpdate();
    }
  }

  private handlePageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pageSize = parseInt(select.value, 10);
    this.currentPage = 0; // Reset to first page
    this.requestUpdate();
  }

  private get displayedRows(): AmortizationRow[] {
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    return this.rows.slice(start, end);
  }

  private get totalPages(): number {
    return Math.ceil(this.rows.length / this.pageSize);
  }

  private get currentPageNumber(): number {
    return this.currentPage + 1;
  }

  private get hasSavingsData(): boolean {
    return this.rows.some((row) => row.risparmiAccumulati !== undefined);
  }

  private get hasDeductionsData(): boolean {
    return this.rows.some((row) => row.detrazioniAccumulate !== undefined);
  }

  private get hasEarlyClosureResources(): boolean {
    return this.hasSavingsData || this.hasDeductionsData;
  }

  private getTotalForEarlyClosure(row: AmortizationRow): number {
    const savings = row.risparmiAccumulati || 0;
    const deductions = row.detrazioniAccumulate || 0;
    return savings + deductions;
  }

  render() {
    if (this.rows.length === 0) {
      return html`<p class="no-data">Nessun dato disponibile</p>`;
    }

    // Calculate totals
    const lastRow = this.rows[this.rows.length - 1];
    const totalInterest = lastRow.totaleIntaressPagato;
    const totalPrincipal = lastRow.totalePrincipalPagato;

    return html`
      <div class="table-container">
        <div class="table-info">
          <div class="info-item">
            <span class="info-label">Totale Interessi:</span>
            <span class="info-value">${MortgageCalculator.formatCurrency(totalInterest)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Totale Capitale:</span>
            <span class="info-value">${MortgageCalculator.formatCurrency(totalPrincipal)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Numero Rate:</span>
            <span class="info-value">${this.rows.length}</span>
          </div>
        </div>

        <table class="amortization-table">
          <thead>
            <tr>
              <th>Anno/Mese</th>
              <th>Quota Interessi</th>
              <th>Quota Capitale</th>
              <th>Rata Mensile</th>
              <th>Tot. Interessi</th>
              <th>Tot. Capitale</th>
              <th>Capitale Rimanente</th>
              ${this.hasDeductionsData ? html`<th>Detrazioni Accumulate</th>` : ''}
              ${this.hasSavingsData ? html`<th>Risparmi Accumulati</th>` : ''}
              ${this.hasEarlyClosureResources ? html`<th>Totale per Chiusura Anticipata</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${this.displayedRows.map(
              (row, idx) => html`
                <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
                  <td class="row-numero">${row.anno}/${String(row.mese + 1).padStart(2, '0')}</td>
                  <td class="row-currency">
                    ${MortgageCalculator.formatCurrency(row.quotaInteressi)}
                  </td>
                  <td class="row-currency">
                    ${MortgageCalculator.formatCurrency(row.quotaCapitale)}
                  </td>
                  <td class="row-currency">
                    ${MortgageCalculator.formatCurrency(row.totaleRataMensile)}
                  </td>
                  <td class="row-currency">
                    ${MortgageCalculator.formatCurrency(row.totaleIntaressPagato)}
                  </td>
                  <td class="row-currency">
                    ${MortgageCalculator.formatCurrency(row.totalePrincipalPagato)}
                  </td>
                  <td class="row-currency">
                    ${MortgageCalculator.formatCurrency(row.capitaleRimanente)}
                  </td>
                  ${this.hasDeductionsData
                    ? html`<td class="row-currency">
                        ${row.detrazioniAccumulate !== undefined
                          ? MortgageCalculator.formatCurrency(row.detrazioniAccumulate)
                          : '—'}
                      </td>`
                    : ''}
                  ${this.hasSavingsData
                    ? html`<td class="row-currency">
                        ${row.risparmiAccumulati !== undefined
                          ? MortgageCalculator.formatCurrency(row.risparmiAccumulati)
                          : '—'}
                      </td>`
                    : ''}
                  ${this.hasEarlyClosureResources
                    ? html`<td class="row-currency strong">
                        ${MortgageCalculator.formatCurrency(this.getTotalForEarlyClosure(row))}
                      </td>`
                    : ''}
                </tr>
              `
            )}
          </tbody>
        </table>

        <div class="pagination-controls">
          <div class="page-size-selector">
            <label for="page-size-select">Righe per pagina:</label>
            <select
              id="page-size-select"
              .value=${this.pageSize.toString()}
              @change=${this.handlePageSizeChange}
            >
              ${this.pageSizeOptions.map(
                (size) =>
                  html`<option value="${size}">
                    ${size} (${size / 12} anno${size / 12 > 1 ? 'i' : ''})
                  </option>`
              )}
            </select>
          </div>

          ${this.totalPages > 1
            ? html`
                <div class="pagination">
                  <button
                    class="pagination-btn"
                    @click=${this.handlePreviousPage}
                    ?disabled=${this.currentPage === 0}
                  >
                    ← Precedente
                  </button>
                  <span class="pagination-info">
                    Pagina ${this.currentPageNumber} di ${this.totalPages}
                  </span>
                  <button
                    class="pagination-btn"
                    @click=${this.handleNextPage}
                    ?disabled=${this.currentPage === this.totalPages - 1}
                  >
                    Successiva →
                  </button>
                </div>
              `
            : ''}
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .no-data {
      padding: 2rem;
      text-align: center;
      color: var(--gray-700);
    }

    .table-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .table-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      padding: 1rem;
      background: var(--gray-100);
      border-radius: 0.5rem;
    }

    .info-item {
      display: flex;
      flex-direction: column;
    }

    .info-label {
      font-size: 0.85rem;
      color: var(--gray-700);
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .info-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--primary);
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .amortization-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    th {
      background: var(--primary);
      color: white;
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--gray-200);
      font-size: 0.9rem;
    }

    tr.even {
      background: #f9fafb;
    }

    tr.odd {
      background: white;
    }

    tr:hover {
      background: #f3f4f6;
    }

    .row-numero {
      font-weight: 600;
      color: var(--gray-900);
    }

    .row-currency {
      font-family: 'Monaco', 'Courier New', monospace;
      text-align: right;
    }

    .pagination-controls {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .page-size-selector {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }

    .page-size-selector label {
      font-weight: 600;
      color: var(--gray-900);
      font-size: 0.95rem;
    }

    .page-size-selector select {
      padding: 0.5rem 0.75rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      background: white;
      color: var(--gray-900);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .page-size-selector select:hover {
      border-color: var(--primary);
    }

    .page-size-selector select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--gray-100);
      border-radius: 0.5rem;
    }

    .pagination-btn {
      padding: 0.5rem 1rem;
      background: white;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      color: var(--gray-900);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .pagination-btn:hover:not(:disabled) {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination-info {
      color: var(--gray-700);
      font-weight: 600;
    }

    @media (max-width: 768px) {
      th,
      td {
        padding: 0.5rem;
        font-size: 0.8rem;
      }

      th {
        font-size: 0.75rem;
      }

      .pagination {
        flex-direction: column;
        gap: 0.5rem;
      }

      .pagination-btn {
        width: 100%;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'amortization-table': AmortizationTable;
  }
}
