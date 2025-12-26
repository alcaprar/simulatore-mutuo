import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { VirtualAmortizationRow } from '../types.js';

@customElement('virtual-amortization-table')
export class VirtualAmortizationTable extends LitElement {
  @property({ type: Array })
  rows: VirtualAmortizationRow[] = [];

  @state()
  private currentPage: number = 1;

  @state()
  private expandedRows: Set<number> = new Set();

  @state()
  private rowsPerPage: number = 12; // Show 12 months (1 year) per page by default

  private readonly pageSizeOptions = [12, 24, 36, 48, 60, 72]; // Multiples of 12 (years)

  get totalPages(): number {
    return Math.ceil(this.rows.length / this.rowsPerPage);
  }

  get paginatedRows(): VirtualAmortizationRow[] {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const end = start + this.rowsPerPage;
    return this.rows.slice(start, end);
  }

  private toggleRowExpand(periodo: number): void {
    if (this.expandedRows.has(periodo)) {
      this.expandedRows.delete(periodo);
    } else {
      this.expandedRows.add(periodo);
    }
    this.requestUpdate();
  }

  private previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.requestUpdate();
    }
  }

  private nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.requestUpdate();
    }
  }

  private handlePageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.rowsPerPage = parseInt(select.value, 10);
    this.currentPage = 1; // Reset to first page
    this.requestUpdate();
  }

  render() {
    if (this.rows.length === 0) {
      return html`<p class="no-data">Nessun dato di ammortamento disponibile</p>`;
    }

    return html`
      <div class="table-container">
        <div class="table-wrapper">
          <table class="amortization-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Anno/Mese</th>
                <th>Mutui Attivi</th>
                <th>Interessi</th>
                <th>Capitale</th>
                <th>Rata Mensile</th>
                <th>Capitale Rimanente</th>
                <th style="text-align: center;">Dettagli</th>
              </tr>
            </thead>
            <tbody>
              ${this.paginatedRows.map(
                (row) => html`
                  <tr class="data-row ${row.activeMortgageCount === 0 ? 'inactive' : ''}">
                    <td>${row.periodo}</td>
                    <td><strong>${row.meseName}</strong> ${row.anno}</td>
                    <td class="active-count">
                      ${row.activeMortgageCount > 0
                        ? html`<span class="active-badge">${row.activeMortgageCount}</span>`
                        : html`<span class="inactive-badge">-</span>`}
                    </td>
                    <td class="currency">
                      ${new Intl.NumberFormat('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(row.quotaInteressi)}
                    </td>
                    <td class="currency">
                      ${new Intl.NumberFormat('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(row.quotaCapitale)}
                    </td>
                    <td class="currency strong">
                      ${new Intl.NumberFormat('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(row.totaleRataMensile)}
                    </td>
                    <td class="currency">
                      ${new Intl.NumberFormat('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(row.capitaleRimanente)}
                    </td>
                    <td style="text-align: center;">
                      ${row.activeMortgageCount > 0
                        ? html`
                            <button
                              class="expand-btn"
                              @click=${() => this.toggleRowExpand(row.periodo)}
                              title="Mostra dettagli"
                            >
                              ${this.expandedRows.has(row.periodo) ? '▼' : '▶'}
                            </button>
                          `
                        : '-'}
                    </td>
                  </tr>

                  ${this.expandedRows.has(row.periodo)
                    ? html`
                        <tr class="breakdown-row">
                          <td colspan="8">
                            <div class="breakdown-table">
                              <table class="breakdown-details">
                                <thead>
                                  <tr>
                                    <th>Mutuo</th>
                                    <th>Stato</th>
                                    <th>Interessi</th>
                                    <th>Capitale</th>
                                    <th>Rata</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${row.breakdown.map(
                                    (item) => html`
                                      <tr class="${item.isActive ? 'active' : 'inactive'}">
                                        <td class="mortgage-name">${item.mortgageName}</td>
                                        <td class="status">
                                          ${item.isActive
                                            ? html`<span class="active-label">Attivo</span>`
                                            : html`<span class="inactive-label">Non attivo</span>`}
                                        </td>
                                        <td class="currency">
                                          ${new Intl.NumberFormat('it-IT', {
                                            style: 'currency',
                                            currency: 'EUR',
                                          }).format(item.quotaInteressi)}
                                        </td>
                                        <td class="currency">
                                          ${new Intl.NumberFormat('it-IT', {
                                            style: 'currency',
                                            currency: 'EUR',
                                          }).format(item.quotaCapitale)}
                                        </td>
                                        <td class="currency strong">
                                          ${new Intl.NumberFormat('it-IT', {
                                            style: 'currency',
                                            currency: 'EUR',
                                          }).format(item.totaleRataMensile)}
                                        </td>
                                      </tr>
                                    `
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      `
                    : ''}
                `
              )}
            </tbody>
          </table>
        </div>

        <div class="pagination-controls">
          <div class="page-size-selector">
            <label for="page-size-select">Righe per pagina:</label>
            <select
              id="page-size-select"
              .value=${this.rowsPerPage.toString()}
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

          <div class="pagination">
            <button
              @click=${this.previousPage}
              ?disabled=${this.currentPage === 1}
              class="btn-pagination"
            >
              ← Precedente
            </button>
            <span class="page-info">Pagina ${this.currentPage} di ${this.totalPages}</span>
            <button
              @click=${this.nextPage}
              ?disabled=${this.currentPage === this.totalPages}
              class="btn-pagination"
            >
              Successiva →
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

    .table-container {
      display: flex;
      flex-direction: column;
    }

    .table-wrapper {
      overflow-x: auto;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }

    thead {
      background: var(--gray-100);
      border-bottom: 2px solid var(--gray-300);
    }

    th {
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: var(--gray-900);
      font-size: 0.9rem;
      white-space: nowrap;
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--gray-200);
      font-size: 0.9rem;
    }

    tbody tr {
      transition: background-color 0.2s;
    }

    tbody tr:hover {
      background-color: var(--gray-50);
    }

    tbody tr.even {
      background-color: var(--gray-50);
    }

    tbody tr.inactive {
      opacity: 0.6;
    }

    .data-row.inactive td {
      color: var(--gray-500);
    }

    .currency {
      text-align: right;
      font-family: 'Monaco', 'Courier New', monospace;
      font-weight: 500;
      color: var(--primary);
    }

    .currency.strong {
      font-weight: 700;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%);
    }

    .active-count {
      text-align: center;
    }

    .active-badge {
      background: var(--primary);
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .inactive-badge {
      color: var(--gray-500);
      font-weight: 600;
    }

    .expand-btn {
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0.25rem;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }

    .expand-btn:hover {
      background: #2563eb;
    }

    .breakdown-row {
      background: linear-gradient(135deg, var(--gray-50) 0%, white 100%);
    }

    .breakdown-table {
      padding: 1rem;
    }

    .breakdown-details {
      width: 100%;
      font-size: 0.85rem;
      border: 1px solid var(--gray-200);
      border-radius: 0.5rem;
      overflow: hidden;
    }

    .breakdown-details thead {
      background: var(--gray-200);
    }

    .breakdown-details th {
      padding: 0.5rem;
      font-size: 0.8rem;
      border-bottom: 1px solid var(--gray-300);
    }

    .breakdown-details td {
      padding: 0.5rem;
      border-bottom: 1px solid var(--gray-200);
    }

    .breakdown-details tr.inactive {
      opacity: 0.5;
      background: var(--gray-100);
    }

    .breakdown-details tr.active td {
      background: linear-gradient(
        135deg,
        rgba(59, 130, 246, 0.05) 0%,
        rgba(59, 130, 246, 0.02) 100%
      );
    }

    .mortgage-name {
      font-weight: 600;
      color: var(--gray-900);
    }

    .status {
      text-align: center;
    }

    .active-label {
      background: var(--success);
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .inactive-label {
      background: var(--gray-300);
      color: var(--gray-700);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
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
      justify-content: center;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--gray-50);
      border-radius: 0.5rem;
    }

    .btn-pagination {
      padding: 0.5rem 1rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-pagination:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-pagination:disabled {
      background: var(--gray-300);
      cursor: not-allowed;
      opacity: 0.6;
    }

    .page-info {
      color: var(--gray-700);
      font-weight: 600;
      min-width: 150px;
      text-align: center;
    }

    .no-data {
      padding: 2rem;
      text-align: center;
      color: var(--gray-700);
    }

    @media (max-width: 768px) {
      th,
      td {
        padding: 0.5rem;
        font-size: 0.8rem;
      }

      .expand-btn {
        padding: 0.125rem 0.375rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'virtual-amortization-table': VirtualAmortizationTable;
  }
}
