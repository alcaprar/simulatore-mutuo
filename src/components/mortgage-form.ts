import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MortgageInput } from '../types.js';

@customElement('mortgage-form')
export class MortgageForm extends LitElement {
  @property({ type: Object })
  initialInput?: MortgageInput;

  @state()
  private importoTotale: number = 250000;

  @state()
  private mesePartenza: number = new Date().getMonth();

  @state()
  private annoPartenza: number = new Date().getFullYear();

  @state()
  private durataAnni: number = 20;

  @state()
  private tassoInteresse: number = 4.5;

  @state()
  private speseIstruttoriaTipo: 'percentage' | 'fixed' = 'percentage';

  @state()
  private speseIstruttoriaValore: number = 1.0;

  @state()
  private speseIncassoRata: number = 0;

  @state()
  private spesaPerizia: number = 600;

  @state()
  private numeroPerizie: number = 1;

  @state()
  private assicurazioneIncendioTipo: 'onetime' | 'monthly' = 'onetime';

  @state()
  private assicurazioneIncendioValore: number = 0;

  @state()
  private assicurazioneAggiuntivaTipo: 'onetime' | 'monthly' = 'monthly';

  @state()
  private assicurazioneAggiuntivaValore: number = 0;

  @state()
  private risparmiMensiliForecast: number = 0;

  @state()
  private detrazioneRistrutturazione: number = 0;

  @state()
  private detrazioniInteressi: boolean = false;

  private lastInputId?: string;
  private isInitialized: boolean = false;

  connectedCallback() {
    super.connectedCallback();
    // Ensure form is initialized with correct data when component is created
    if (!this.isInitialized) {
      this.isInitialized = true;
      this.loadInitialData();
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('initialInput')) {
      // Reload when initialInput changes, including when it becomes undefined
      const currentInputId = this.initialInput
        ? `${JSON.stringify(this.initialInput)}`
        : 'undefined';
      if (this.lastInputId !== currentInputId) {
        this.lastInputId = currentInputId;
        this.loadInitialData();
      }
    }
  }

  private loadInitialData(): void {
    if (this.initialInput) {
      // Load from existing data
      this.importoTotale = this.initialInput.importoTotale;
      this.mesePartenza = this.initialInput.mesePartenza;
      this.annoPartenza = this.initialInput.annoPartenza;
      this.durataAnni = this.initialInput.durataAnni;
      this.tassoInteresse = this.initialInput.tassoInteresse;
      this.speseIstruttoriaTipo = this.initialInput.speseIstruttoria.tipo;
      this.speseIstruttoriaValore = this.initialInput.speseIstruttoria.valore;
      this.speseIncassoRata = this.initialInput.speseIncassoRata;
      this.spesaPerizia = this.initialInput.spesaPerizia;
      this.numeroPerizie = this.initialInput.numeroPerizie || 1;
      this.assicurazioneIncendioTipo = this.initialInput.assicurazioneIncendio?.tipo || 'onetime';
      this.assicurazioneIncendioValore = this.initialInput.assicurazioneIncendio?.valore || 0;
      this.assicurazioneAggiuntivaTipo =
        this.initialInput.assicurazioneAggiuntiva?.tipo || 'monthly';
      this.assicurazioneAggiuntivaValore = this.initialInput.assicurazioneAggiuntiva?.valore || 0;
      this.risparmiMensiliForecast = this.initialInput.risparmiMensiliForecast || 0;
      this.detrazioneRistrutturazione = this.initialInput.detrazioneRistrutturazione || 0;
      this.detrazioniInteressi = this.initialInput.detrazioniInteressi || false;
    } else {
      // Reset to defaults when no initial input
      this.importoTotale = 250000;
      this.mesePartenza = new Date().getMonth();
      this.annoPartenza = new Date().getFullYear();
      this.durataAnni = 20;
      this.tassoInteresse = 4.5;
      this.speseIstruttoriaTipo = 'percentage';
      this.speseIstruttoriaValore = 1.0;
      this.speseIncassoRata = 0;
      this.spesaPerizia = 600;
      this.numeroPerizie = 1;
      this.assicurazioneIncendioTipo = 'onetime';
      this.assicurazioneIncendioValore = 0;
      this.assicurazioneAggiuntivaTipo = 'monthly';
      this.assicurazioneAggiuntivaValore = 0;
      this.risparmiMensiliForecast = 0;
      this.detrazioneRistrutturazione = 0;
      this.detrazioniInteressi = false;
    }
  }

  private months = [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
  ];

  private handleSubmit(): void {
    const input: MortgageInput = {
      importoTotale: this.importoTotale,
      mesePartenza: this.mesePartenza,
      annoPartenza: this.annoPartenza,
      durataAnni: this.durataAnni,
      tassoInteresse: this.tassoInteresse,
      speseIstruttoria: {
        tipo: this.speseIstruttoriaTipo,
        valore: this.speseIstruttoriaValore,
      },
      speseIncassoRata: this.speseIncassoRata,
      spesaPerizia: this.spesaPerizia,
      numeroPerizie: this.numeroPerizie || undefined,
      assicurazioneIncendio:
        this.assicurazioneIncendioValore > 0
          ? {
              tipo: this.assicurazioneIncendioTipo,
              valore: this.assicurazioneIncendioValore,
            }
          : undefined,
      assicurazioneAggiuntiva:
        this.assicurazioneAggiuntivaValore > 0
          ? {
              tipo: this.assicurazioneAggiuntivaTipo,
              valore: this.assicurazioneAggiuntivaValore,
            }
          : undefined,
      risparmiMensiliForecast: this.risparmiMensiliForecast || undefined,
      detrazioneRistrutturazione: this.detrazioneRistrutturazione || undefined,
      detrazioniInteressi: this.detrazioniInteressi || undefined,
    };

    this.dispatchEvent(
      new CustomEvent('mortgage-calculated', {
        detail: { input },
        bubbles: true,
        composed: true,
      })
    );
  }

  private resetForm(): void {
    this.importoTotale = 250000;
    this.mesePartenza = new Date().getMonth();
    this.annoPartenza = new Date().getFullYear();
    this.durataAnni = 20;
    this.tassoInteresse = 4.5;
    this.speseIstruttoriaTipo = 'percentage';
    this.speseIstruttoriaValore = 1.0;
    this.speseIncassoRata = 0;
    this.spesaPerizia = 600;
    this.numeroPerizie = 1;
    this.assicurazioneIncendioTipo = 'onetime';
    this.assicurazioneIncendioValore = 0;
    this.assicurazioneAggiuntivaTipo = 'monthly';
    this.assicurazioneAggiuntivaValore = 0;
    this.risparmiMensiliForecast = 0;
    this.detrazioneRistrutturazione = 0;
    this.detrazioniInteressi = false;
  }

  render() {
    return html`
      <form
        @submit=${(e: Event) => {
          e.preventDefault();
          this.handleSubmit();
        }}
      >
        <div class="form-section">
          <h3>Dati Principali</h3>

          <div class="form-group">
            <label for="importo">Importo Totale (€)</label>
            <input
              id="importo"
              type="number"
              min="1000"
              max="10000000"
              step="1000"
              .value=${this.importoTotale}
              @input=${(e: Event) => {
                this.importoTotale = parseFloat((e.target as HTMLInputElement).value);
              }}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="mese">Mese Partenza</label>
              <select
                id="mese"
                @change=${(e: Event) => {
                  this.mesePartenza = parseInt((e.target as HTMLSelectElement).value);
                }}
              >
                ${this.months.map(
                  (m, i) =>
                    html`<option value="${i}" ?selected=${i === this.mesePartenza}>${m}</option>`
                )}
              </select>
            </div>

            <div class="form-group">
              <label for="anno">Anno Partenza</label>
              <input
                id="anno"
                type="number"
                min="2000"
                max="2100"
                .value=${this.annoPartenza}
                @input=${(e: Event) => {
                  this.annoPartenza = parseInt((e.target as HTMLInputElement).value);
                }}
              />
            </div>
          </div>

          <div class="form-group">
            <label for="durata">Durata (anni)</label>
            <input
              id="durata"
              type="number"
              min="1"
              max="50"
              step="1"
              .value=${this.durataAnni}
              @input=${(e: Event) => {
                this.durataAnni = parseInt((e.target as HTMLInputElement).value);
              }}
            />
            <small class="form-hint">${this.durataAnni * 12} mesi</small>
          </div>

          <div class="form-group">
            <label for="tasso">Tasso di Interesse (% annuale)</label>
            <input
              id="tasso"
              type="number"
              min="0"
              max="20"
              step="0.01"
              .value=${this.tassoInteresse}
              @input=${(e: Event) => {
                this.tassoInteresse = parseFloat((e.target as HTMLInputElement).value);
              }}
            />
          </div>
        </div>

        <div class="form-section">
          <h3>Spese</h3>

          <div class="form-group">
            <label>Spese Istruttoria</label>
            <div class="fee-input-group">
              <select
                .value=${this.speseIstruttoriaTipo}
                @change=${(e: Event) => {
                  this.speseIstruttoriaTipo = (e.target as HTMLSelectElement).value as
                    | 'percentage'
                    | 'fixed';
                }}
              >
                <option value="percentage">% dell'importo</option>
                <option value="fixed">Importo fisso (€)</option>
              </select>
              <input
                type="number"
                min="0"
                step="${this.speseIstruttoriaTipo === 'percentage' ? '0.01' : '1'}"
                .value=${this.speseIstruttoriaValore}
                @input=${(e: Event) => {
                  this.speseIstruttoriaValore = parseFloat((e.target as HTMLInputElement).value);
                }}
                placeholder="${this.speseIstruttoriaTipo === 'percentage' ? '%' : '€'}"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="incasso">Spese Incasso Rata (€/mese)</label>
            <input
              id="incasso"
              type="number"
              min="0"
              step="0.01"
              .value=${this.speseIncassoRata}
              @input=${(e: Event) => {
                this.speseIncassoRata = parseFloat((e.target as HTMLInputElement).value);
              }}
            />
          </div>

          <div class="form-group">
            <label for="perizia">Spesa Perizia (€)</label>
            <input
              id="perizia"
              type="number"
              min="0"
              step="1"
              .value=${this.spesaPerizia}
              @input=${(e: Event) => {
                this.spesaPerizia = parseFloat((e.target as HTMLInputElement).value);
              }}
            />
          </div>

          <div class="form-group">
            <label for="numero-perizie">
              Numero Perizie
              <span
                class="info-icon"
                title="In alcuni casi, come il mutuo a stato avanzamento lavori (SAL) ci possono essere più di una perizia"
              >
                ℹ️
              </span>
            </label>
            <input
              id="numero-perizie"
              type="number"
              min="1"
              step="1"
              .value=${this.numeroPerizie}
              @input=${(e: Event) => {
                this.numeroPerizie = Math.max(1, parseInt((e.target as HTMLInputElement).value));
              }}
            />
            <small class="form-hint"
              >In alcuni casi, come il mutuo a stato avanzamento lavori (SAL), ci possono essere più
              di una perizia.</small
            >
          </div>
        </div>

        <div class="form-section">
          <h3>Assicurazioni (Opzionali)</h3>

          <div class="form-group">
            <label>Assicurazione Incendio, Scoppio</label>
            <div class="fee-input-group">
              <input
                type="number"
                min="0"
                step="1"
                .value=${this.assicurazioneIncendioValore}
                @input=${(e: Event) => {
                  this.assicurazioneIncendioValore = parseFloat(
                    (e.target as HTMLInputElement).value
                  );
                }}
                placeholder="€"
              />
              <select
                .value=${this.assicurazioneIncendioTipo}
                @change=${(e: Event) => {
                  this.assicurazioneIncendioTipo = (e.target as HTMLSelectElement).value as
                    | 'onetime'
                    | 'monthly';
                }}
              >
                <option value="onetime">Una tantum</option>
                <option value="monthly">Mensile</option>
              </select>
            </div>
            <small class="form-hint">Assicurazione obbligatoria su immobili.</small>
          </div>

          <div class="form-group">
            <label>Assicurazione Aggiuntiva</label>
            <div class="fee-input-group">
              <input
                type="number"
                min="0"
                step="1"
                .value=${this.assicurazioneAggiuntivaValore}
                @input=${(e: Event) => {
                  this.assicurazioneAggiuntivaValore = parseFloat(
                    (e.target as HTMLInputElement).value
                  );
                }}
                placeholder="€"
              />
              <select
                .value=${this.assicurazioneAggiuntivaTipo}
                @change=${(e: Event) => {
                  this.assicurazioneAggiuntivaTipo = (e.target as HTMLSelectElement).value as
                    | 'onetime'
                    | 'monthly';
                }}
              >
                <option value="onetime">Una tantum</option>
                <option value="monthly">Mensile</option>
              </select>
            </div>
            <small class="form-hint"
              >Coperture aggiuntive come morte, malattia, disoccupazione.</small
            >
          </div>
        </div>

        <div class="form-section">
          <h3>Chiusura Anticipata (Opzionale)</h3>

          <div class="form-group">
            <label for="risparmi">Risparmi Mensili (€)</label>
            <input
              id="risparmi"
              type="number"
              min="0"
              step="10"
              .value=${this.risparmiMensiliForecast}
              @input=${(e: Event) => {
                this.risparmiMensiliForecast = parseFloat((e.target as HTMLInputElement).value);
              }}
            />
            <small class="form-hint"
              >Importo che puoi risparmiare ogni mese per estinguere il mutuo
              anticipatamente.</small
            >
          </div>

          <div class="form-group">
            <label>
              <input
                type="checkbox"
                .checked=${this.detrazioniInteressi}
                @change=${(e: Event) => {
                  this.detrazioniInteressi = (e.target as HTMLInputElement).checked;
                }}
              />
              Includi Detrazioni Interessi (19% annuale, max €760/anno)
            </label>
            <small class="form-hint"
              >Il governo restituisce il 19% degli interessi pagati ogni luglio, fino a €760 per
              anno. Questo importo si aggiungerà ai risparmi mensili.</small
            >
          </div>

          <div class="form-group">
            <label for="ristrutturazione">Importo Ristrutturazione (€)</label>
            <input
              id="ristrutturazione"
              type="number"
              min="0"
              step="1000"
              .value=${this.detrazioneRistrutturazione}
              @input=${(e: Event) => {
                this.detrazioneRistrutturazione = parseFloat((e.target as HTMLInputElement).value);
              }}
            />
            <small class="form-hint"
              >Costi di ristrutturazione (max €96.000 detraibili). Riceverai il 36% di questo
              importo, distribuito in 10 rate annuali. Lascia vuoto se non applicabile.</small
            >
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" @click=${this.resetForm}>Ripristina</button>
          <button type="submit" class="btn-primary">Calcola Piano di Ammortamento</button>
        </div>
      </form>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    form {
      max-width: 600px;
    }

    .form-section {
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid var(--gray-200);
    }

    .form-section:last-of-type {
      border-bottom: none;
    }

    h3 {
      margin: 0 0 1.5rem 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--gray-900);
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: var(--gray-700);
      font-size: 0.95rem;
    }

    input[type='number'],
    input[type='text'],
    select {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid var(--gray-200);
      border-radius: 0.5rem;
      font-family: inherit;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    input[type='number']:focus,
    input[type='text']:focus,
    select:focus {
      outline: none;
      border-color: var(--primary);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-hint {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.85rem;
      color: var(--gray-700);
    }

    .info-icon {
      cursor: help;
      margin-left: 0.5rem;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .info-icon:hover {
      opacity: 1;
    }

    .fee-input-group {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 0.75rem;
    }

    input[type='checkbox'] {
      width: auto;
      margin-right: 0.5rem;
      cursor: pointer;
      accent-color: var(--primary);
    }

    .form-group label:has(input[type='checkbox']) {
      display: flex;
      align-items: center;
      font-weight: 500;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 2px solid var(--gray-200);
    }

    .btn-primary,
    .btn-secondary {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
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

    .btn-primary {
      background: var(--primary);
      color: white;
      flex: 1;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    @media (max-width: 640px) {
      .form-row {
        grid-template-columns: 1fr;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn-secondary,
      .btn-primary {
        width: 100%;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'mortgage-form': MortgageForm;
  }
}
