import { parseISO } from '../dates';
import { forecastGoal, requiredMonthlyContribution } from '../forecast';
import { interestDates, totalTermInterest } from '../termDeposit';
import type { TermDeposit } from '../types';

const td = (over: Partial<TermDeposit> = {}): TermDeposit => ({
  id: 'td1',
  bank: 'BNZ',
  principal: 10_000,
  rate: 0.046,
  startDate: '2026-03-14',
  termMonths: 12,
  interestFrequency: 'maturity',
  onMaturity: 'payout',
  ...over,
});

describe('term deposit interest', () => {
  it('matches the worked example: $10k @ 4.6% for 12 months, 30% RWT → $322 net', () => {
    const i = totalTermInterest(td(), 0.3);
    expect(i.gross).toBeCloseTo(460, 2);
    expect(i.tax).toBeCloseTo(138, 2);
    expect(i.net).toBeCloseTo(322, 2);
  });

  it('pays quarterly interest four times, ending at maturity', () => {
    const dates = interestDates(td({ interestFrequency: 'quarterly' }));
    expect(dates.map((d) => d.toDateString())).toEqual([
      parseISO('2026-06-14').toDateString(),
      parseISO('2026-09-14').toDateString(),
      parseISO('2026-12-14').toDateString(),
      parseISO('2027-03-14').toDateString(),
    ]);
  });
});

describe('forecastGoal', () => {
  const base = {
    start: parseISO('2026-11-07'),
    rwt: 0.3,
    savings: [] as { balance: number; rate: number }[],
    termDeposits: [] as TermDeposit[],
  };

  it('reaches a goal from contributions alone', () => {
    const r = forecastGoal({ ...base, target: 12_000, monthlyContribution: 1_000 });
    expect(r.reachedDate?.toDateString()).toBe(parseISO('2027-11-07').toDateString());
    expect(r.points[12].total).toBe(12_000);
    expect(r.interestEarned).toBe(0);
  });

  it('is already reached when the starting balance covers the target', () => {
    const r = forecastGoal({ ...base, target: 500, monthlyContribution: 0, savings: [{ balance: 600, rate: 0 }] });
    expect(r.reachedDate).toEqual(base.start);
  });

  it('adds savings interest monthly after RWT', () => {
    const r = forecastGoal({
      ...base,
      target: 1e9,
      monthlyContribution: 0,
      savings: [{ balance: 12_000, rate: 0.03 }],
      maxMonths: 1,
    });
    // 12,000 × 3% / 12 × 0.7 = 21
    expect(r.points[1].interest).toBeCloseTo(21, 6);
  });

  it('pays a TD out into savings at maturity', () => {
    const r = forecastGoal({
      ...base,
      start: parseISO('2026-11-07'),
      target: 1e9,
      monthlyContribution: 0,
      termDeposits: [td()],
      maxMonths: 6,
    });
    // Matures 14 Mar 2027, inside the step ending 7 Apr 2027 (month 5).
    expect(r.points[4].total).toBe(10_000);
    expect(r.points[5].total).toBeCloseTo(10_322, 2);
    expect(r.events.find((e) => e.kind === 'td-matured')?.amount).toBeCloseTo(322, 2);
  });

  it('compounds an at-maturity TD when reinvested, at the rollover rate', () => {
    const r = forecastGoal({
      ...base,
      start: parseISO('2026-03-14'),
      target: 1e9,
      monthlyContribution: 0,
      termDeposits: [td({ onMaturity: 'reinvest', rolloverRate: 0.05 })],
      maxMonths: 24,
    });
    const matured = r.events.filter((e) => e.kind === 'td-matured');
    expect(matured).toHaveLength(2);
    expect(matured[0].amount).toBeCloseTo(322, 2);
    // Second term runs Mar 2027 → Mar 2028, which includes 29 Feb: 366 days.
    const second = (10_322 * 0.05 * 366) / 365 * 0.7;
    expect(matured[1].amount).toBeCloseTo(second, 2);
    expect(r.points[24].total).toBeCloseTo(10_322 + second, 2);
  });

  it('pays quarterly TD interest into savings and totals the same as at-maturity', () => {
    const r = forecastGoal({
      ...base,
      start: parseISO('2026-03-14'),
      target: 1e9,
      monthlyContribution: 0,
      termDeposits: [td({ interestFrequency: 'quarterly' })],
      maxMonths: 12,
    });
    expect(r.events.filter((e) => e.kind === 'td-interest')).toHaveLength(3);
    expect(r.points[12].total).toBeCloseTo(10_322, 2);
  });

  it('ignores interest already paid before today', () => {
    const r = forecastGoal({
      ...base,
      start: parseISO('2026-10-01'),
      target: 1e9,
      monthlyContribution: 0,
      termDeposits: [td({ interestFrequency: 'quarterly' })],
      maxMonths: 12,
    });
    // Only the Dec 2026 and Mar 2027 payments are still to come.
    const paid = r.events.filter((e) => e.kind === 'td-interest' || e.kind === 'td-matured');
    expect(paid).toHaveLength(2);
  });

  it('includes TD principal and interest when deciding when the goal is reached', () => {
    const withoutTd = forecastGoal({ ...base, target: 30_000, monthlyContribution: 900, savings: [{ balance: 2_600, rate: 0.03 }] });
    const withTd = forecastGoal({
      ...base,
      target: 30_000,
      monthlyContribution: 900,
      savings: [{ balance: 2_600, rate: 0.03 }],
      termDeposits: [td()],
    });
    expect(withTd.reachedDate!.getTime()).toBeLessThan(withoutTd.reachedDate!.getTime());
  });
});

describe('requiredMonthlyContribution', () => {
  it('finds the smallest monthly amount that hits the target by the date', () => {
    const input = {
      start: parseISO('2026-11-07'),
      target: 12_000,
      targetDate: parseISO('2027-11-07'),
      monthlyContribution: 0,
      savings: [],
      termDeposits: [],
      rwt: 0.3,
    };
    expect(requiredMonthlyContribution(input)).toBe(1_000);
  });

  it('is 0 when the goal is already funded', () => {
    expect(
      requiredMonthlyContribution({
        start: parseISO('2026-11-07'),
        target: 100,
        targetDate: parseISO('2027-11-07'),
        monthlyContribution: 0,
        savings: [{ balance: 200, rate: 0 }],
        termDeposits: [],
        rwt: 0.3,
      }),
    ).toBe(0);
  });
});
