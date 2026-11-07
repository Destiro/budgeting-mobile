import { parseISO } from '../../lib/dates';
import type { Transaction } from '../../lib/types';
import { demoState, deserialize, reducer, serialize } from '../state';

const today = parseISO('2026-11-07');

describe('own data', () => {
  it('starts empty but keeps categories, rules, budgets and settings', () => {
    const demo = demoState(today);
    const mine = reducer(demo, { type: 'startOwn' });
    expect(mine.mode).toBe('mine');
    expect(mine.accounts).toEqual([]);
    expect(mine.transactions).toEqual([]);
    expect(mine.goals).toEqual([]);
    expect(mine.termDeposits).toEqual([]);
    expect(mine.rules).toBe(demo.rules);
    expect(mine.budgets).toBe(demo.budgets);
  });

  it('survives a save and reload', () => {
    let s = reducer(demoState(today), { type: 'startOwn' });
    s = reducer(s, {
      type: 'saveAccount',
      account: { id: 'a1', bank: 'ASB', name: 'Pay', type: 'everyday', balance: 10, source: 'manual' },
    });
    const loaded = deserialize(serialize(s), today)!;
    expect(loaded.mode).toBe('mine');
    expect(loaded.accounts).toEqual(s.accounts);
    expect(loaded.today).toBe(today);
  });

  it('ignores missing or broken saved data', () => {
    expect(deserialize(null, today)).toBeNull();
    expect(deserialize('{not json', today)).toBeNull();
    expect(deserialize('{"version":99}', today)).toBeNull();
  });
});

describe('importTransactions', () => {
  const base = () => {
    let s = reducer(demoState(today), { type: 'startOwn' });
    for (const [id, bank, type] of [
      ['asb', 'ASB', 'everyday'],
      ['bnz', 'BNZ', 'everyday'],
    ] as const) {
      s = reducer(s, { type: 'saveAccount', account: { id, bank, name: id, type, balance: 0, source: 'manual' } });
    }
    return s;
  };
  const tx = (id: string, accountId: string, date: string, amount: number, description: string): Transaction => ({
    id,
    accountId,
    date,
    amount,
    description,
    categoryId: null,
  });

  it('categorises with rules, matches transfers across two imports, and updates the balance', () => {
    let s = reducer(base(), {
      type: 'importTransactions',
      accountId: 'asb',
      transactions: [tx('1', 'asb', '2026-11-06', 2410, 'ACME LTD SALARY'), tx('2', 'asb', '2026-11-06', -1500, 'MB TRANSFER')],
      balance: 290.12,
    });
    expect(s.transactions.find((t) => t.id === '1')?.categoryId).toBe('income');
    expect(s.transactions.find((t) => t.id === '2')?.categoryId).toBeNull();
    expect(s.accounts.find((a) => a.id === 'asb')).toMatchObject({ balance: 290.12, source: 'csv' });

    // The BNZ side arrives in a later import and pairs with the ASB side.
    s = reducer(s, {
      type: 'importTransactions',
      accountId: 'bnz',
      transactions: [tx('3', 'bnz', '2026-11-07', 1500, 'ACME PAY'), tx('4', 'bnz', '2026-11-07', -86.4, 'COUNTDOWN PONSONBY')],
    });
    expect(s.transactions.find((t) => t.id === '2')).toMatchObject({ categoryId: 'transfer', transferPairId: '3' });
    expect(s.transactions.find((t) => t.id === '4')?.categoryId).toBe('groceries');
    expect(s.accounts.find((a) => a.id === 'bnz')?.balance).toBe(0);
  });

  it('deleting an account removes its transactions and frees their transfer partners', () => {
    let s = reducer(base(), {
      type: 'importTransactions',
      accountId: 'asb',
      transactions: [tx('1', 'asb', '2026-11-06', -100, 'X')],
    });
    s = reducer(s, { type: 'importTransactions', accountId: 'bnz', transactions: [tx('2', 'bnz', '2026-11-06', 100, 'Y')] });
    s = reducer(s, { type: 'saveGoal', goal: { id: 'g', name: 'G', emoji: '🎯', target: 1, targetDate: '2027-01-01', monthlyContribution: 0, accountIds: ['asb', 'bnz'] } });
    s = reducer(s, { type: 'deleteAccount', id: 'asb' });
    expect(s.transactions).toEqual([expect.objectContaining({ id: '2', categoryId: null, transferPairId: undefined })]);
    expect(s.goals[0].accountIds).toEqual(['bnz']);
  });
});
