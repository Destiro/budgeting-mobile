import {
  applyRules,
  currentPeriod,
  merchantKey,
  monthlyCashFlow,
  netWorthHistory,
  spendByCategory,
} from '../analytics';
import { parseISO, toISO } from '../dates';
import type { Transaction } from '../types';

const tx = (date: string, amount: number, categoryId: string | null = 'groceries', description = 'X'): Transaction => ({
  id: `${date}${amount}`,
  accountId: 'a',
  date,
  amount,
  description,
  categoryId,
});

const today = parseISO('2026-11-07');

describe('monthlyCashFlow', () => {
  it('buckets income and spending by month and skips transfers', () => {
    const flows = monthlyCashFlow(
      [
        tx('2026-10-03', 2000, 'income'),
        tx('2026-10-05', -100),
        tx('2026-11-01', -50),
        tx('2026-11-02', -900, 'transfer'),
        tx('2026-01-01', -999),
      ],
      2,
      today,
    );
    expect(flows.map((f) => [toISO(f.month), f.in, f.out])).toEqual([
      ['2026-10-01', 2000, 100],
      ['2026-11-01', 0, 50],
    ]);
  });
});

describe('currentPeriod', () => {
  it('uses the calendar month for monthly budgets', () => {
    const p = currentPeriod({ rwt: 0.3, budgetPeriod: 'monthly', paydayAnchor: '2026-01-02' }, today);
    expect([toISO(p.start), toISO(p.end)]).toEqual(['2026-11-01', '2026-12-01']);
  });

  it('aligns fortnights to payday, even when the anchor is in the future', () => {
    const s = { rwt: 0.3, budgetPeriod: 'fortnightly' as const, paydayAnchor: '2026-10-30' };
    expect(toISO(currentPeriod(s, today).start)).toBe('2026-10-30');
    expect(toISO(currentPeriod({ ...s, paydayAnchor: '2027-01-08' }, today).start)).toBe('2026-10-30');
  });
});

describe('spendByCategory', () => {
  it('sums spending per category in the period', () => {
    const p = { start: parseISO('2026-11-01'), end: parseISO('2026-12-01') };
    const m = spendByCategory([tx('2026-11-02', -10), tx('2026-11-03', -5), tx('2026-11-03', -7, null), tx('2026-10-31', -99)], p);
    expect(m.get('groceries')).toBe(15);
    expect(m.get(null)).toBe(7);
  });
});

describe('netWorthHistory', () => {
  it('works backwards from current balances', () => {
    const accounts = [{ id: 'a', bank: 'ASB' as const, name: 'A', type: 'everyday' as const, balance: 1000, source: 'manual' as const }];
    const h = netWorthHistory(accounts, [], [tx('2026-11-02', 200, 'income'), tx('2026-10-15', -50)], 3, today);
    expect(h.map((p) => p.value)).toEqual([850, 800, 1000]);
  });
});

describe('rules', () => {
  it('categorises uncategorised transactions that match', () => {
    const out = applyRules(
      [tx('2026-11-01', -38.5, null, 'UBER *EATS 4821'), tx('2026-11-01', -10, 'fun', 'UBER *EATS')],
      [{ id: 'r', match: 'uber *eats', categoryId: 'eating-out' }],
    );
    expect(out.map((t) => t.categoryId)).toEqual(['eating-out', 'fun']);
  });

  it('derives a merchant key without card numbers or locations', () => {
    expect(merchantKey('UBER *EATS 4821 AUCKLAND')).toBe('UBER *EATS');
    expect(merchantKey('COUNTDOWN PONSONBY AUCKLAND NZ')).toBe('COUNTDOWN PONSONBY');
  });
});
