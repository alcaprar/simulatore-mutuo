import type { MortgageInput, AmortizationRow, EarlyClosureData } from '../types.js';

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

export class MortgageCalculator {
  /**
   * Calculate the monthly interest rate from annual rate
   */
  private static getMonthlyRate(annualRate: number): number {
    return annualRate / 100 / 12;
  }

  /**
   * Calculate monthly payment using the amortization formula
   * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
   * where P = principal, r = monthly rate, n = number of periods
   */
  private static calculateMonthlyPayment(
    principal: number,
    annualRate: number,
    months: number
  ): number {
    const monthlyRate = this.getMonthlyRate(annualRate);

    if (monthlyRate === 0) {
      return principal / months;
    }

    const numerator = monthlyRate * Math.pow(1 + monthlyRate, months);
    const denominator = Math.pow(1 + monthlyRate, months) - 1;

    return principal * (numerator / denominator);
  }

  /**
   * Calculate all upfront fees
   */
  private static calculateUpfrontFees(input: MortgageInput): number {
    let totalFees = 0;

    // Spese istruttoria
    if (input.speseIstruttoria.tipo === 'percentage') {
      totalFees += (input.importoTotale * input.speseIstruttoria.valore) / 100;
    } else {
      totalFees += input.speseIstruttoria.valore;
    }

    // Spesa perizia
    const numeroPerizie = input.numeroPerizie || 1;
    totalFees += input.spesaPerizia * numeroPerizie;

    return totalFees;
  }

  /**
   * Generate the complete amortization schedule
   */
  static generateAmortization(input: MortgageInput): AmortizationRow[] {
    const upfrontFees = this.calculateUpfrontFees(input);
    const principalAmount = input.importoTotale - upfrontFees;
    const totalMonths = input.durataAnni * 12;
    const monthlyRate = this.getMonthlyRate(input.tassoInteresse);
    const monthlyPayment = this.calculateMonthlyPayment(
      principalAmount,
      input.tassoInteresse,
      totalMonths
    );

    const schedule: AmortizationRow[] = [];
    let remainingCapital = principalAmount;
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;
    let accumulatedSavings = 0;
    let accumulatedDeductions = 0;

    // Pre-calculate yearly interest deductions if enabled
    const yearlyInterestDeductions: Record<number, number> = {};
    const monthlyInterestPaid: number[] = [];
    if (input.detrazioniInteressi) {
      // We need a temporary schedule to calculate interest deductions
      let tempRemainingCapital = principalAmount;
      let tempCurrentYear = input.annoPartenza;
      let tempCurrentMonth = input.mesePartenza;

      for (let periodo = 1; periodo <= totalMonths; periodo++) {
        const tempInterestPortion = tempRemainingCapital * monthlyRate;
        monthlyInterestPaid.push(tempInterestPortion);
        tempRemainingCapital -= monthlyPayment - tempInterestPortion;

        if (tempRemainingCapital < 0) {
          tempRemainingCapital = 0;
        }

        // Interest deductions happen in July (month 6)
        if (tempCurrentMonth === 6) {
          // Calculate interest paid in the last 12 months (looking back from July)
          const interestLast12Months = monthlyInterestPaid
            .slice(Math.max(0, periodo - 12), periodo)
            .reduce((sum, interest) => sum + interest, 0);
          const interestDeduction = Math.min(interestLast12Months * 0.19, 760);
          yearlyInterestDeductions[tempCurrentYear] = interestDeduction;
        }

        tempCurrentMonth++;
        if (tempCurrentMonth > 11) {
          tempCurrentMonth = 0;
          tempCurrentYear++;
        }
      }
    }

    // Calculate renovation deduction (capped at €96,000)
    const cappedRenovationAmount = Math.min(input.detrazioneRistrutturazione || 0, 96000);
    const renovationDeduction =
      cappedRenovationAmount > 0 ? (cappedRenovationAmount * 0.36) / 10 : 0;

    let currentMonth = input.mesePartenza;
    let currentYear = input.annoPartenza;

    for (let periodo = 1; periodo <= totalMonths; periodo++) {
      // Calculate interest for this period
      const interestPortion = remainingCapital * monthlyRate;

      // Calculate principal for this period
      const principalPortion = monthlyPayment - interestPortion;

      // Update totals
      totalInterestPaid += interestPortion;
      totalPrincipalPaid += principalPortion;

      // Update remaining capital
      remainingCapital -= principalPortion;

      // Ensure remaining capital doesn't go negative due to rounding
      if (remainingCapital < 0) {
        remainingCapital = 0;
      }

      // Accumulate savings if specified
      if (input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0) {
        accumulatedSavings += input.risparmiMensiliForecast;
      }

      // Accumulate deductions
      // Add interest deduction if in July
      if (
        input.detrazioniInteressi &&
        currentMonth === 6 &&
        yearlyInterestDeductions[currentYear]
      ) {
        accumulatedDeductions += yearlyInterestDeductions[currentYear];
      }

      // Add renovation deduction every month (spread across 12 months)
      if (renovationDeduction > 0) {
        accumulatedDeductions += renovationDeduction / 12;
      }

      // Add collection fees to the monthly payment (if any)
      const totalMonthlyPayment = monthlyPayment + input.speseIncassoRata;

      const row: AmortizationRow = {
        periodo,
        anno: currentYear,
        mese: currentMonth,
        meseName: MONTHS[currentMonth],
        quotaInteressi: interestPortion,
        quotaCapitale: principalPortion,
        totaleRataMensile: totalMonthlyPayment,
        totaleIntaressPagato: totalInterestPaid,
        totalePrincipalPagato: totalPrincipalPaid,
        capitaleRimanente: remainingCapital,
      };

      // Only add accumulated savings if forecasted savings are provided
      if (input.risparmiMensiliForecast && input.risparmiMensiliForecast > 0) {
        row.risparmiAccumulati = accumulatedSavings;
      }

      // Only add accumulated deductions if deductions are enabled or renovation amount is set
      const hasDeductions =
        input.detrazioniInteressi ||
        (input.detrazioneRistrutturazione && input.detrazioneRistrutturazione > 0);
      if (hasDeductions) {
        row.detrazioniAccumulate = accumulatedDeductions;
      }

      schedule.push(row);

      // Move to next month
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }

    return schedule;
  }

  /**
   * Format a number as currency (EUR)
   */
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Format a percentage
   */
  static formatPercentage(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  /**
   * Calculate early closure based on monthly savings and tax deductions
   */
  static calculateEarlyClosure(
    schedule: AmortizationRow[],
    monthlySavings: number,
    includeInterestDeductions: boolean = false,
    renovationAmount: number = 0
  ): EarlyClosureData {
    if (monthlySavings <= 0 && !includeInterestDeductions && renovationAmount <= 0) {
      return { isPossible: false };
    }

    let accumulatedSavings = 0;
    const yearlyInterestDeductions: Record<number, number> = {};

    // Calculate yearly interest deductions if enabled
    if (includeInterestDeductions) {
      for (const row of schedule) {
        const year = row.anno;
        const month = row.mese;

        // Interest deductions happen in July (month 6)
        if (month === 6) {
          // Calculate 19% of interest paid up to July, capped at €760
          const interestDeduction = Math.min(row.totaleIntaressPagato * 0.19, 760);
          yearlyInterestDeductions[year] = interestDeduction;
        }
      }
    }

    // Calculate yearly renovation deduction (capped at €96,000)
    const cappedRenovationAmount = Math.min(renovationAmount, 96000);
    const renovationDeduction =
      cappedRenovationAmount > 0 ? (cappedRenovationAmount * 0.36) / 10 : 0;

    for (const row of schedule) {
      // Add monthly savings
      accumulatedSavings += monthlySavings;

      // Add interest deduction if in July
      if (includeInterestDeductions && row.mese === 6 && yearlyInterestDeductions[row.anno]) {
        accumulatedSavings += yearlyInterestDeductions[row.anno];
      }

      // Add renovation deduction every month (spread across 12 months)
      if (renovationDeduction > 0) {
        accumulatedSavings += renovationDeduction / 12;
      }

      const remainingCapital = row.capitaleRimanente;

      // Check if accumulated savings are enough to cover remaining capital
      if (accumulatedSavings >= remainingCapital) {
        const monthsFromStart = row.periodo;
        const totalMonths = schedule.length;
        const monthsSaved = totalMonths - monthsFromStart;

        return {
          isPossible: true,
          meseChiusura: row.periodo,
          annoChiusura: row.anno,
          risparmiAccumulati: accumulatedSavings,
          capitalePagato: remainingCapital,
          mesiRisparmiati: monthsSaved,
        };
      }
    }

    // Savings are not enough to close early
    return { isPossible: false };
  }

  /**
   * Calculate early closure based on amortization schedule data
   * This method derives the early closure from the table rows, ensuring
   * consistency between the detail view and the amortization table
   */
  static calculateEarlyClosureFromSchedule(schedule: AmortizationRow[]): EarlyClosureData {
    if (schedule.length === 0) {
      return { isPossible: false };
    }

    // Find the first row where accumulated resources >= remaining capital
    for (const row of schedule) {
      const totalForClosure = (row.risparmiAccumulati || 0) + (row.detrazioniAccumulate || 0);

      if (totalForClosure >= row.capitaleRimanente) {
        const monthsFromStart = row.periodo;
        const totalMonths = schedule.length;
        const monthsSaved = totalMonths - monthsFromStart;

        return {
          isPossible: true,
          meseChiusura: row.periodo,
          annoChiusura: row.anno,
          risparmiAccumulati: totalForClosure,
          capitalePagato: row.capitaleRimanente,
          mesiRisparmiati: monthsSaved,
        };
      }
    }

    return { isPossible: false };
  }
}
