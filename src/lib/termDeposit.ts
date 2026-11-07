import { addMonths, daysBetween, parseISO } from './dates';
import type { TermDeposit } from './types';

export function maturityDate(td: Pick<TermDeposit, 'startDate' | 'termMonths'>): Date {
  return addMonths(parseISO(td.startDate), td.termMonths);
}

export function termDays(td: Pick<TermDeposit, 'startDate' | 'termMonths'>): number {
  return daysBetween(parseISO(td.startDate), maturityDate(td));
}

/**
 * Simple interest over a number of days, as NZ banks calculate it
 * (daily rate = annual / 365), split into gross, RWT and net.
 */
export function interestForDays(principal: number, rate: number, days: number, rwt: number) {
  const gross = (principal * rate * days) / 365;
  const tax = gross * rwt;
  return { gross, tax, net: gross - tax };
}

/** Total interest over the whole term. Simple interest: periodic payments are paid out, not compounded. */
export function totalTermInterest(td: TermDeposit, rwt: number) {
  return interestForDays(td.principal, td.rate, termDays(td), rwt);
}

/** Months between interest payments; null when interest is only paid at maturity. */
export function interestStepMonths(td: Pick<TermDeposit, 'interestFrequency'>): number | null {
  if (td.interestFrequency === 'monthly') return 1;
  if (td.interestFrequency === 'quarterly') return 3;
  return null;
}

/** All interest payment dates in the term, ending with maturity. */
export function interestDates(td: TermDeposit): Date[] {
  const start = parseISO(td.startDate);
  const maturity = maturityDate(td);
  const step = interestStepMonths(td);
  const dates: Date[] = [];
  if (step) {
    for (let k = 1; ; k++) {
      const d = addMonths(start, k * step);
      if (d >= maturity) break;
      dates.push(d);
    }
  }
  dates.push(maturity);
  return dates;
}

/** Fraction of the term elapsed at `today`, clamped to 0..1. */
export function termProgress(td: TermDeposit, today: Date): number {
  const total = termDays(td);
  if (total <= 0) return 1;
  const done = daysBetween(parseISO(td.startDate), today);
  return Math.min(1, Math.max(0, done / total));
}
