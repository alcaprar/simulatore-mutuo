import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { AmortizationRow } from '../types.js'
import { MortgageCalculator } from '../utils/mortgage-calculator.js'

@customElement('amortization-table')
export class AmortizationTable extends LitElement {
  @property({ type: Array })
  rows: AmortizationRow[] = []

  private currentPage: number = 0
  private pageSize: number = 12 // Show 12 months per page

  private handlePreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--
    }
  }

  private handleNextPage(): void {
    const maxPage = Math.ceil(this.rows.length / this.pageSize) - 1
    if (this.currentPage < maxPage) {
      this.currentPage++
    }
  }

  private get displayedRows(): AmortizationRow[] {
    const start = this.currentPage * this.pageSize
    const end = start + this.pageSize
    return this.rows.slice(start, end)
  }

  private get totalPages(): number {
    return Math.ceil(this.rows.length / this.pageSize)
  }

  private get currentPageNumber(): number {
    return this.currentPage + 1
  }

  private get hasSavingsData(): boolean {
    return this.rows.some((row) => row.risparmiAccumulati !== undefined)
  }

  render() {
    if (this.rows.length === 0) {
      return html`<p class="no-data">Nessun dato disponibile</p>`
    }

    // Calculate totals
    const lastRow = this.rows[this.rows.length - 1]
    const totalInterest = lastRow.totaleIntaressPagato
    const totalPrincipal = lastRow.totalePrincipalPagato

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
              ${this.hasSavingsData ? html`<th>Risparmi Accumulati</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${this.displayedRows.map(
              (row, idx) => html`
                <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
                  <td class="row-numero">${row.anno}/${String(row.mese + 1).padStart(2, '0')}</td>
                  <td class="row-currency">${MortgageCalculator.formatCurrency(row.quotaInteressi)}</td>
                  <td class="row-currency">${MortgageCalculator.formatCurrency(row.quotaCapitale)}</td>
                  <td class="row-currency">${MortgageCalculator.formatCurrency(row.totaleRataMensile)}</td>
                  <td class="row-currency">${MortgageCalculator.formatCurrency(row.totaleIntaressPagato)}</td>
                  <td class="row-currency">${MortgageCalculator.formatCurrency(row.totalePrincipalPagato)}</td>
                  <td class="row-currency">${MortgageCalculator.formatCurrency(row.capitaleRimanente)}</td>
                  ${this.hasSavingsData
                    ? html`<td class="row-currency">
                        ${row.risparmiAccumulati !== undefined
                          ? MortgageCalculator.formatCurrency(row.risparmiAccumulati)
                          : '—'}
                      </td>`
                    : ''}
                </tr>
              `
            )}
          </tbody>
        </table>

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

        <div class="table-export">
          <button class="export-btn" @click=${this.exportToCSV}>📥 Scarica CSV</button>
        </div>
      </div>
    `
  }

  private exportToCSV(): void {
    const headers = [
      'Anno/Mese',
      'Quota Interessi',
      'Quota Capitale',
      'Rata Mensile',
      'Tot. Interessi',
      'Tot. Capitale',
      'Capitale Rimanente',
    ]

    if (this.hasSavingsData) {
      headers.push('Risparmi Accumulati')
    }

    const rows = this.rows.map((row) => {
      const rowData = [
        `${row.anno}/${String(row.mese + 1).padStart(2, '0')}`,
        row.quotaInteressi.toFixed(2),
        row.quotaCapitale.toFixed(2),
        row.totaleRataMensile.toFixed(2),
        row.totaleIntaressPagato.toFixed(2),
        row.totalePrincipalPagato.toFixed(2),
        row.capitaleRimanente.toFixed(2),
      ]

      if (this.hasSavingsData) {
        rowData.push(
          row.risparmiAccumulati !== undefined ? row.risparmiAccumulati.toFixed(2) : ''
        )
      }

      return rowData
    })

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(','))

    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `piano_ammortamento_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

    .table-export {
      display: flex;
      justify-content: center;
    }

    .export-btn {
      padding: 0.75rem 1.5rem;
      background: var(--success);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .export-btn:hover {
      background: #059669;
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
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'amortization-table': AmortizationTable
  }
}
