import { applyRules, monthlyCashFlow, monthlySavingsInflow } from '../analytics';
import { parseISO } from '../dates';
import { matchTransfers } from '../transfers';
import type { Transaction } from '../types';
import { rules, sampleGoals, sampleTransactions } from '../../data/sample';

let seq = 0;
const tx = (date: string, accountId: string, amount: number, categoryId: string | null = null, description = 'X'): Transaction => ({
  id: `t${++seq}`,
  accountId,
  date,
  amount,
  description,
  categoryId,
});

describe('matchTransfers', () => {
  it('pairs the same amount out of one account and into another', () => {
    const [a, b] = matchTransfers([tx('2026-11-06', 'asb', -500), tx('2026-11-07', 'bnz', 500)]);
    expect(a.categoryId).toBe('transfer');
    expect(b.categoryId).toBe('transfer');
    expect(a.transferPairId).toBe(b.id);
    expect(b.transferPairId).toBe(a.id);
  });

  it('matches a credit card repayment so the card spending is not counted twice', () => {
    const out = matchTransfers([tx('2026-11-08', 'bnz-everyday', -812.34), tx('2026-11-08', 'bnz-card', 812.34)]);
    expect(out.map((t) => t.categoryId)).toEqual(['transfer', 'transfer']);
  });

  it('does not pair within one account, across different amounts, or outside the window', () => {
    const input = [
      tx('2026-11-01', 'a', -100),
      tx('2026-11-01', 'a', 100),
      tx('2026-11-01', 'a', -50),
      tx('2026-11-01', 'b', 50.01),
      tx('2026-11-01', 'a', -70),
      tx('2026-11-10', 'b', 70),
    ];
    expect(matchTransfers(input)).toEqual(input);
  });

  it('never overwrites a category you chose', () => {
    const input = [tx('2026-11-06', 'asb', -500, 'rent'), tx('2026-11-06', 'bnz', 500)];
    expect(matchTransfers(input)).toEqual(input);
  });

  it('uses each transaction once and prefers the closest dates', () => {
    const out = matchTransfers([
      tx('2026-11-05', 'asb', -200),
      tx('2026-11-08', 'asb', -200),
      tx('2026-11-08', 'bnz', 200),
    ]);
    expect(out[0].categoryId).toBeNull();
    expect(out[1].categoryId).toBe('transfer');
    expect(out[2].transferPairId).toBe(out[1].id);
  });

  it('is stable when run again', () => {
    const once = matchTransfers([tx('2026-11-06', 'asb', -500), tx('2026-11-07', 'bnz', 500)]);
    expect(matchTransfers(once)).toBe(once);
  });
});

describe('monthlySavingsInflow', () => {
  const today = parseISO('2026-11-07');
  it('averages transfers into the savings account over complete months, ignoring moves between linked accounts', () => {
    const t = matchTransfers([
      tx('2026-08-10', 'eve', -300),
      tx('2026-08-10', 'sav', 300),
      tx('2026-09-10', 'eve', -600),
      tx('2026-09-10', 'sav', 600),
      tx('2026-10-10', 'eve', -300),
      tx('2026-10-10', 'sav', 300),
      // between two linked accounts: not new saving
      tx('2026-10-12', 'sav', -50),
      tx('2026-10-12', 'sav2', 50),
      // current month is incomplete and excluded
      tx('2026-11-02', 'eve', -999),
      tx('2026-11-02', 'sav', 999),
      tx('2026-07-01', 'x', -1),
    ]);
    expect(monthlySavingsInflow(t, ['sav', 'sav2'], 3, today)).toBe(400);
  });

  it('only averages over months that exist when history is short', () => {
    const t = matchTransfers([
      tx('2026-10-02', 'eve', -300),
      tx('2026-10-02', 'sav', 300),
    ]);
    expect(monthlySavingsInflow(t, ['sav'], 3, today)).toBe(300);
  });
});

describe('demo data follows your payday flow', () => {
  const today = parseISO('2026-11-07');
  const raw = applyRules(sampleTransactions(today), rules);
  const all = matchTransfers(raw);

  it('starts with no transfers tagged, so matching has to find them', () => {
    expect(raw.filter((t) => t.categoryId === 'transfer')).toHaveLength(0);
  });

  it('tags every transfer, card repayment and account-to-account payment, and nothing else', () => {
    const moves = all.filter((t) => /TRANSFER|PAYMENT|ASB ACME PAY/.test(t.description) && !/RENT J SMITH/.test(t.description));
    expect(moves.length).toBeGreaterThan(40);
    expect(moves.every((t) => t.categoryId === 'transfer' && t.transferPairId)).toBe(true);
    expect(all.filter((t) => t.categoryId === 'transfer').length).toBe(moves.length);
  });

  it('pairs each transfer with an equal and opposite amount in a different account', () => {
    const byId = new Map(all.map((t) => [t.id, t]));
    for (const t of all.filter((x) => x.categoryId === 'transfer')) {
      const p = byId.get(t.transferPairId!)!;
      expect(p.transferPairId).toBe(t.id);
      expect(p.amount).toBeCloseTo(-t.amount, 2);
      expect(p.accountId).not.toBe(t.accountId);
    }
  });

  it('counts card spending once: repayments are excluded from cash flow out', () => {
    const month = monthlyCashFlow(all, 3, today)[1];
    const inMonth = all.filter((t) => t.date.startsWith('2026-10'));
    const repaid = inMonth.filter((t) => t.description === 'CREDIT CARD PAYMENT').reduce((s, t) => s - t.amount, 0);
    const cardSpend = inMonth.filter((t) => t.accountId === 'bnz-credit' && t.amount < 0).reduce((s, t) => s - t.amount, 0);
    const rentAndBills = inMonth
      .filter((t) => t.accountId !== 'bnz-credit' && t.categoryId !== 'transfer' && t.amount < 0)
      .reduce((s, t) => s - t.amount, 0);
    expect(repaid).toBeGreaterThan(0);
    expect(month.out).toBeCloseTo(cardSpend + rentAndBills, 2);
    expect(month.out).toBeLessThan(cardSpend + rentAndBills + repaid);
    // Income is just pay: 2 or 3 paydays of $2,410.
    expect([4820, 7230]).toContain(month.in);
  });

  it('leaves only the three recent unsorted transactions uncategorised', () => {
    expect(all.filter((t) => !t.categoryId)).toHaveLength(3);
  });

  it('derives the house goal contribution from what moves into Rapid Save', () => {
    const goal = sampleGoals(today)[0];
    expect(goal.accountIds).toEqual(['bnz-savings']);
    // $450 lands every payday; three complete months hold 6 or 7 paydays.
    const total = monthlySavingsInflow(all, goal.accountIds, 3, today) * 3;
    expect([2700, 3150]).toContain(Math.round(total));
  });
});
