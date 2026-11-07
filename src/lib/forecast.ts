/**
 * Goal forecast engine.
 *
 * Steps forward one month at a time from `start`. Each step:
 *   1. Savings earn a month of interest (rate / 12, after RWT).
 *   2. The monthly contribution is added to savings.
 *   3. Any term deposit interest payment or maturity falling in the step is applied:
 *      - periodic (monthly/quarterly) interest is paid into savings;
 *      - at maturity, at-maturity interest is either added to a reinvested TD
 *        (compounding) or paid out with the principal into savings.
 *
 * Interest on at-maturity TDs is only counted once it is paid, so the forecast
 * never relies on money that isn't in your account yet.
 */
import { addMonths, daysBetween, parseISO, toISO } from './dates';
import { interestDates, interestForDays, maturityDate } from './termDeposit';
import type { TermDeposit } from './types';

export interface SavingsSource {
  balance: number;
  /** Annual rate as a decimal */
  rate: number;
}

export interface ForecastInput {
  start: Date;
  target: number;
  targetDate?: Date;
  monthlyContribution: number;
  savings: SavingsSource[];
  termDeposits: TermDeposit[];
  /** RWT as a decimal, e.g. 0.3 */
  rwt: number;
  /** Safety cap on simulation length (default 10 years) */
  maxMonths?: number;
}

export interface ForecastPoint {
  date: Date;
  /** Money already saved at the start (savings + TD principal) */
  startingBalance: number;
  /** Cumulative contributions so far */
  contributions: number;
  /** Cumulative interest earned so far, after RWT */
  interest: number;
  total: number;
}

export type ForecastEventKind = 'td-interest' | 'td-matured' | 'goal-reached' | 'target-date';

export interface ForecastEvent {
  date: Date;
  kind: ForecastEventKind;
  label: string;
  amount?: number;
}

export interface ForecastResult {
  points: ForecastPoint[];
  /** First month-end where the total meets the target, or null if not within maxMonths */
  reachedDate: Date | null;
  /** Interest earned (after RWT) up to the reached date, or to the end of the forecast */
  interestEarned: number;
  events: ForecastEvent[];
}

interface LiveTD {
  td: TermDeposit;
  dates: Date[];
  /** Date of the previous interest payment (or the start) */
  lastPaid: Date;
}

function blendedRate(savings: SavingsSource[]): number {
  const total = savings.reduce((s, a) => s + a.balance, 0);
  if (total <= 0) return savings[0]?.rate ?? 0;
  return savings.reduce((s, a) => s + a.balance * a.rate, 0) / total;
}

function tdLabel(td: TermDeposit): string {
  return `${td.bank} TD ${td.termMonths}m @ ${(td.rate * 100).toFixed(2)}%`;
}

export function forecastGoal(input: ForecastInput): ForecastResult {
  const { start, target, targetDate, monthlyContribution, rwt } = input;
  const maxMonths = input.maxMonths ?? 120;
  const savingsRate = blendedRate(input.savings);

  let savings = input.savings.reduce((s, a) => s + a.balance, 0);
  // Only TDs that haven't matured yet are simulated; matured ones are assumed to already be in savings.
  const tds: LiveTD[] = input.termDeposits
    .filter((td) => maturityDate(td) > start)
    .map((td) => {
      const dates = interestDates(td);
      // Interest payments on or before today have already been paid out.
      const past = dates.filter((d) => d <= start);
      return {
        td: { ...td },
        dates: dates.filter((d) => d > start),
        lastPaid: past.length ? past[past.length - 1] : parseISO(td.startDate),
      };
    });

  const startingBalance = savings + tds.reduce((s, l) => s + l.td.principal, 0);
  let contributions = 0;
  const totalNow = () => savings + tds.reduce((s, l) => s + l.td.principal, 0);

  const points: ForecastPoint[] = [
    { date: start, startingBalance, contributions: 0, interest: 0, total: startingBalance },
  ];
  const events: ForecastEvent[] = [];
  let reachedDate: Date | null = startingBalance >= target ? start : null;
  if (reachedDate) events.push({ date: start, kind: 'goal-reached', label: 'Goal reached' });

  for (let m = 1; m <= maxMonths; m++) {
    const next = addMonths(start, m);

    savings += savings * (savingsRate / 12) * (1 - rwt);
    savings += monthlyContribution;
    contributions += monthlyContribution;

    for (const l of tds) {
      while (l.dates.length && l.dates[0] <= next) {
        const payDate = l.dates.shift()!;
        const days = daysBetween(l.lastPaid, payDate);
        const { net } = interestForDays(l.td.principal, l.td.rate, days, rwt);
        l.lastPaid = payDate;
        const isMaturity = l.dates.length === 0;

        if (!isMaturity) {
          savings += net;
          events.push({ date: payDate, kind: 'td-interest', label: `${tdLabel(l.td)} interest`, amount: net });
          continue;
        }

        events.push({ date: payDate, kind: 'td-matured', label: `${tdLabel(l.td)} matures`, amount: net });
        if (l.td.onMaturity === 'reinvest') {
          const compounding = l.td.interestFrequency === 'maturity';
          if (compounding) l.td.principal += net;
          else savings += net;
          l.td = {
            ...l.td,
            startDate: toISO(payDate),
            rate: l.td.rolloverRate ?? l.td.rate,
          };
          l.dates = interestDates(l.td);
        } else {
          savings += l.td.principal + net;
          l.td = { ...l.td, principal: 0 };
        }
      }
    }

    const total = totalNow();
    points.push({
      date: next,
      startingBalance,
      contributions,
      interest: total - startingBalance - contributions,
      total,
    });

    if (!reachedDate && total >= target) {
      reachedDate = next;
      events.push({ date: next, kind: 'goal-reached', label: 'Goal reached' });
    }

    const pastTarget = !targetDate || next >= targetDate;
    if (reachedDate && pastTarget) break;
  }

  if (targetDate) events.push({ date: targetDate, kind: 'target-date', label: 'Target date' });
  events.sort((a, b) => +a.date - +b.date);

  const at = reachedDate ? points.find((p) => p.date >= reachedDate!) : points[points.length - 1];
  return {
    points,
    reachedDate,
    interestEarned: at?.interest ?? 0,
    events,
  };
}

/** Total at (or just after) a date, using a forecast's monthly points. */
export function valueAt(result: ForecastResult, date: Date): number {
  const p = result.points.find((pt) => pt.date >= date) ?? result.points[result.points.length - 1];
  return p.total;
}

/**
 * Smallest whole-dollar monthly contribution that reaches the target by the target date.
 * Returns 0 when the goal is reached without contributing.
 */
export function requiredMonthlyContribution(input: ForecastInput): number | null {
  if (!input.targetDate) return null;
  const months = Math.max(1, Math.ceil(daysBetween(input.start, input.targetDate) / 30.44));
  const reaches = (c: number) => {
    const r = forecastGoal({ ...input, monthlyContribution: c, maxMonths: months });
    return r.reachedDate !== null && r.reachedDate <= addMonths(input.start, months);
  };
  if (reaches(0)) return 0;
  let lo = 0;
  let hi = Math.max(input.target, 1);
  while (!reaches(hi)) hi *= 2;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (reaches(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
