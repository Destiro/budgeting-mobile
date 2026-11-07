/**
 * App state, its reducer, and how it is saved. Pure (no storage or React imports) so it can be tested.
 *
 * Two modes:
 * - demo: generated sample data, never saved
 * - mine: your own accounts and transactions, saved on the device after every change
 */
import { applyRules, merchantKey, TRANSFER_CATEGORY } from '../lib/analytics';
import { toISO } from '../lib/dates';
import { matchTransfers } from '../lib/transfers';
import type { Account, Budget, Category, Goal, Rule, Settings, TermDeposit, Transaction } from '../lib/types';
import * as sample from './sample';

export interface State {
  mode: 'demo' | 'mine';
  today: Date;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  rules: Rule[];
  termDeposits: TermDeposit[];
  goals: Goal[];
  budgets: Budget[];
  settings: Settings;
  /** Hides the getting-started checklist on Home */
  onboardingDismissed?: boolean;
}

export type Action =
  | { type: 'categorise'; id: string; categoryId: string; makeRule: boolean }
  | { type: 'addTransaction'; tx: Omit<Transaction, 'id'> }
  | { type: 'importTransactions'; accountId: string; transactions: Transaction[]; balance?: number }
  | { type: 'saveAccount'; account: Account }
  | { type: 'deleteAccount'; id: string }
  | { type: 'saveTermDeposit'; td: TermDeposit }
  | { type: 'deleteTermDeposit'; id: string }
  | { type: 'saveGoal'; goal: Goal }
  | { type: 'deleteGoal'; id: string }
  | { type: 'setBudget'; categoryId: string; amount: number }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'startOwn' }
  | { type: 'resetToDemo' }
  | { type: 'dismissOnboarding' };

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

const upsert = <T extends { id: string }>(xs: T[], x: T) =>
  xs.some((y) => y.id === x.id) ? xs.map((y) => (y.id === x.id ? x : y)) : [...xs, x];

const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date);

export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function demoState(today: Date): State {
  return {
    mode: 'demo',
    today,
    accounts: sample.accounts,
    transactions: matchTransfers(applyRules(sample.sampleTransactions(today), sample.rules)),
    categories: sample.categories,
    rules: sample.rules,
    termDeposits: sample.sampleTermDeposits(today),
    goals: sample.sampleGoals(today),
    budgets: sample.budgets,
    settings: sample.defaultSettings(today),
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'categorise': {
      const target = state.transactions.find((t) => t.id === action.id);
      if (!target) return state;
      const toTransfer = action.categoryId === TRANSFER_CATEGORY;
      let transactions = state.transactions.map((t) => {
        if (t.id === action.id) {
          return { ...t, categoryId: action.categoryId, transferPairId: toTransfer ? t.transferPairId : undefined };
        }
        // Un-marking one side of a transfer releases the other side too.
        if (!toTransfer && t.id === target.transferPairId) return { ...t, categoryId: null, transferPairId: undefined };
        return t;
      });
      let rules = state.rules;
      if (action.makeRule) {
        const match = merchantKey(target.description);
        const rule = { id: newId('rule'), match, categoryId: action.categoryId };
        rules = [rule, ...rules.filter((r) => r.match.toLowerCase() !== match.toLowerCase())];
        transactions = applyRules(transactions, [rule]);
      }
      // Marking a transaction as a transfer may let its other half be found.
      if (toTransfer) transactions = matchTransfers(transactions);
      return { ...state, transactions, rules };
    }
    case 'addTransaction': {
      const tx = { ...action.tx, id: newId('tx') };
      const [categorised] = tx.categoryId ? [tx] : applyRules([tx], state.rules);
      const transactions = matchTransfers([categorised, ...state.transactions].sort(byDateDesc));
      const accounts = state.accounts.map((a) => (a.id === tx.accountId ? { ...a, balance: a.balance + tx.amount } : a));
      return { ...state, transactions, accounts };
    }
    case 'importTransactions': {
      const incoming = applyRules(action.transactions, state.rules);
      const transactions = matchTransfers([...incoming, ...state.transactions].sort(byDateDesc));
      const accounts = state.accounts.map((a) =>
        a.id === action.accountId
          ? { ...a, source: 'csv' as const, balance: action.balance ?? a.balance }
          : a,
      );
      return { ...state, transactions, accounts };
    }
    case 'saveAccount':
      return { ...state, accounts: upsert(state.accounts, action.account) };
    case 'deleteAccount': {
      const removed = new Set(state.transactions.filter((t) => t.accountId === action.id).map((t) => t.id));
      const transactions = state.transactions
        .filter((t) => !removed.has(t.id))
        // A transfer whose other side was in the deleted account is no longer a matched pair.
        .map((t) => (t.transferPairId && removed.has(t.transferPairId) ? { ...t, categoryId: null, transferPairId: undefined } : t));
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.id),
        transactions,
        goals: state.goals.map((g) => ({ ...g, accountIds: g.accountIds.filter((id) => id !== action.id) })),
      };
    }
    case 'saveTermDeposit':
      return { ...state, termDeposits: upsert(state.termDeposits, action.td) };
    case 'deleteTermDeposit':
      return { ...state, termDeposits: state.termDeposits.filter((t) => t.id !== action.id) };
    case 'saveGoal':
      return { ...state, goals: upsert(state.goals, action.goal) };
    case 'deleteGoal':
      return {
        ...state,
        goals: state.goals.filter((g) => g.id !== action.id),
        termDeposits: state.termDeposits.map((t) => (t.goalId === action.id ? { ...t, goalId: undefined } : t)),
      };
    case 'setBudget': {
      const rest = state.budgets.filter((b) => b.categoryId !== action.categoryId);
      return {
        ...state,
        budgets: action.amount > 0 ? [...rest, { categoryId: action.categoryId, amount: action.amount }] : rest,
      };
    }
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'startOwn':
      // Keep categories, rules (including any you made), budgets and settings; clear the demo money.
      return {
        ...state,
        mode: 'mine',
        accounts: [],
        transactions: [],
        termDeposits: [],
        goals: [],
        onboardingDismissed: false,
      };
    case 'resetToDemo':
      return demoState(state.today);
    case 'dismissOnboarding':
      return { ...state, onboardingDismissed: true };
  }
}

/* ---------- Saving ---------- */

export const STORAGE_KEY = 'budget-state';
const VERSION = 1;

type Saved = Omit<State, 'mode' | 'today'> & { version: number };

export function serialize(state: State): string {
  const { mode: _mode, today: _today, ...rest } = state;
  const saved: Saved = { version: VERSION, ...rest };
  return JSON.stringify(saved);
}

/** Rebuilds state from saved JSON, or returns null if there is nothing usable. */
export function deserialize(json: string | null, today: Date): State | null {
  if (!json) return null;
  try {
    const saved = JSON.parse(json) as Partial<Saved>;
    if (saved.version !== VERSION || !Array.isArray(saved.accounts) || !Array.isArray(saved.transactions)) return null;
    return {
      mode: 'mine',
      today,
      accounts: saved.accounts,
      transactions: saved.transactions,
      categories: saved.categories?.length ? saved.categories : sample.categories,
      rules: saved.rules ?? sample.rules,
      termDeposits: saved.termDeposits ?? [],
      goals: saved.goals ?? [],
      budgets: saved.budgets ?? sample.budgets,
      settings: { ...sample.defaultSettings(today), ...saved.settings },
      onboardingDismissed: saved.onboardingDismissed,
    };
  } catch {
    return null;
  }
}

export const todayISO = (s: State) => toISO(s.today);
