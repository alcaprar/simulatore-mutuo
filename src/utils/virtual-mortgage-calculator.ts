import type { MortgageData, VirtualAmortizationRow, MortgageBreakdown } from '../types.js';

const MONTHS = [
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

interface DateKey {
  year: number;
  month: number;
}

export class VirtualMortgageCalculator {
  /**
   * Merge N mortgage amortization schedules into a single timeline
   * Handles different start/end dates by summing only active mortgages per period
   */
  static mergeAmortizationSchedules(mortgages: MortgageData[]): VirtualAmortizationRow[] {
    if (mortgages.length === 0) {
      return [];
    }

    // Find timeline bounds
    const minDate = this.findEarliestStartDate(mortgages);
    const maxDate = this.findLatestEndDate(mortgages);

    if (!minDate || !maxDate) {
      return [];
    }

    const timeline: VirtualAmortizationRow[] = [];
    let currentDate = { ...minDate };
    let periodo = 1;

    while (
      currentDate.year < maxDate.year ||
      (currentDate.year === maxDate.year && currentDate.month <= maxDate.month)
    ) {
      const { year, month } = currentDate;

      // Find active mortgages for this period
      const activeMortgages = mortgages.filter((m) => this.isActiveDuringPeriod(m, year, month));

      // Sum contributions from active mortgages
      const breakdown: MortgageBreakdown[] = [];
      let totalInteressi = 0;
      let totalCapitale = 0;
      let totalRata = 0;
      let totalRemainingCapital = 0;

      for (const mortgage of activeMortgages) {
        const row = this.getRowForPeriod(mortgage, year, month);
        if (row) {
          breakdown.push({
            mortgageId: mortgage.id,
            mortgageName: mortgage.nome,
            quotaInteressi: row.quotaInteressi,
            quotaCapitale: row.quotaCapitale,
            totaleRataMensile: row.totaleRataMensile,
            isActive: true,
          });

          totalInteressi += row.quotaInteressi;
          totalCapitale += row.quotaCapitale;
          totalRata += row.totaleRataMensile;
          totalRemainingCapital += row.capitaleRimanente;
        }
      }

      // Add inactive mortgages to breakdown for transparency
      const inactiveMortgages = mortgages.filter((m) => !this.isActiveDuringPeriod(m, year, month));
      for (const mortgage of inactiveMortgages) {
        breakdown.push({
          mortgageId: mortgage.id,
          mortgageName: mortgage.nome,
          quotaInteressi: 0,
          quotaCapitale: 0,
          totaleRataMensile: 0,
          isActive: false,
        });
      }

      // Create cumulative totals (sum across all periods so far)
      const cumulativeInterest =
        timeline.length > 0
          ? timeline[timeline.length - 1].totaleIntaressPagato + totalInteressi
          : totalInteressi;

      const cumulativePrincipal =
        timeline.length > 0
          ? timeline[timeline.length - 1].totalePrincipalPagato + totalCapitale
          : totalCapitale;

      // Create virtual amortization row
      timeline.push({
        periodo,
        anno: year,
        mese: month,
        meseName: MONTHS[month],
        quotaInteressi: totalInteressi,
        quotaCapitale: totalCapitale,
        totaleRataMensile: totalRata,
        totaleIntaressPagato: cumulativeInterest,
        totalePrincipalPagato: cumulativePrincipal,
        capitaleRimanente: totalRemainingCapital,
        breakdown,
        activeMortgageCount: activeMortgages.length,
      });

      // Move to next month
      currentDate = this.nextMonth(currentDate);
      periodo++;
    }

    return timeline;
  }

  /**
   * Find the earliest start date among all mortgages
   */
  private static findEarliestStartDate(mortgages: MortgageData[]): DateKey | null {
    if (mortgages.length === 0) return null;

    let earliest: DateKey = {
      year: mortgages[0].input.annoPartenza,
      month: mortgages[0].input.mesePartenza,
    };

    for (const mortgage of mortgages) {
      const mortgageStart = {
        year: mortgage.input.annoPartenza,
        month: mortgage.input.mesePartenza,
      };

      if (
        mortgageStart.year < earliest.year ||
        (mortgageStart.year === earliest.year && mortgageStart.month < earliest.month)
      ) {
        earliest = mortgageStart;
      }
    }

    return earliest;
  }

  /**
   * Find the latest end date among all mortgages
   */
  private static findLatestEndDate(mortgages: MortgageData[]): DateKey | null {
    if (mortgages.length === 0) return null;

    let latest: DateKey = {
      year: mortgages[0].input.annoPartenza,
      month: mortgages[0].input.mesePartenza,
    };

    for (const mortgage of mortgages) {
      const startYear = mortgage.input.annoPartenza;
      const startMonth = mortgage.input.mesePartenza;
      const durationMonths = mortgage.input.durataAnni * 12;

      let endMonth = startMonth + durationMonths;
      let endYear = startYear;

      // Normalize the date (handle month overflow)
      endYear += Math.floor(endMonth / 12);
      endMonth = endMonth % 12;

      if (endYear > latest.year || (endYear === latest.year && endMonth > latest.month)) {
        latest = { year: endYear, month: endMonth };
      }
    }

    return latest;
  }

  /**
   * Check if a mortgage is active during a specific period
   */
  private static isActiveDuringPeriod(
    mortgage: MortgageData,
    year: number,
    month: number
  ): boolean {
    const startYear = mortgage.input.annoPartenza;
    const startMonth = mortgage.input.mesePartenza;
    const durationMonths = mortgage.input.durataAnni * 12;

    let endMonth = startMonth + durationMonths;
    let endYear = startYear;

    // Normalize the end date
    endYear += Math.floor(endMonth / 12);
    endMonth = endMonth % 12;

    // Check if period is within mortgage range
    if (year < startYear) return false;
    if (year === startYear && month < startMonth) return false;
    if (year > endYear) return false;
    if (year === endYear && month > endMonth) return false;

    return true;
  }

  /**
   * Get the amortization row for a mortgage at a specific period
   */
  private static getRowForPeriod(
    mortgage: MortgageData,
    year: number,
    month: number
  ): ReturnType<typeof Array.prototype.find> | null {
    for (const row of mortgage.amortization) {
      if (row.anno === year && row.mese === month) {
        return row;
      }
    }
    return null;
  }

  /**
   * Get the next month
   */
  private static nextMonth(date: DateKey): DateKey {
    let { year, month } = date;
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
    return { year, month };
  }

  /**
   * Calculate total amount owed for all source mortgages
   */
  static calculateTotalAmount(mortgages: MortgageData[]): number {
    return mortgages.reduce((sum, m) => sum + m.input.importoTotale, 0);
  }

  /**
   * Calculate total interest paid across all mortgages
   */
  static calculateTotalInterest(mortgages: MortgageData[]): number {
    return mortgages.reduce((sum, m) => {
      if (m.amortization.length === 0) return sum;
      return sum + m.amortization[m.amortization.length - 1].totaleIntaressPagato;
    }, 0);
  }

  /**
   * Calculate total fees for all mortgages
   */
  static calculateTotalFees(mortgages: MortgageData[]): number {
    let totalFees = 0;

    for (const mortgage of mortgages) {
      const input = mortgage.input;
      let fees = 0;

      // Spese istruttoria
      if (input.speseIstruttoria.tipo === 'percentage') {
        fees += (input.importoTotale * input.speseIstruttoria.valore) / 100;
      } else {
        fees += input.speseIstruttoria.valore;
      }

      // Spese incasso rata
      const numMonths = input.durataAnni * 12;
      fees += input.speseIncassoRata * numMonths;

      // Spesa perizia
      const numeroPerizie = input.numeroPerizie || 1;
      fees += input.spesaPerizia * numeroPerizie;

      // Assicurazione Incendio, Scoppio
      if (input.assicurazioneIncendio) {
        if (input.assicurazioneIncendio.tipo === 'onetime') {
          fees += input.assicurazioneIncendio.valore;
        } else {
          fees += input.assicurazioneIncendio.valore * numMonths;
        }
      }

      // Assicurazione Aggiuntiva
      if (input.assicurazioneAggiuntiva) {
        if (input.assicurazioneAggiuntiva.tipo === 'onetime') {
          fees += input.assicurazioneAggiuntiva.valore;
        } else {
          fees += input.assicurazioneAggiuntiva.valore * numMonths;
        }
      }

      totalFees += fees;
    }

    return totalFees;
  }
}
