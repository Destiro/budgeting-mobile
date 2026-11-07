/**
 * App state. In-memory for now (seeded with demo data); persistence (SQLite) and
 * bank sync (Akahu / CSV) plug in here later without changing the screens.
 */
import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { applyRules, merchantKey } from '../lib/analytics';
import { toISO } from '../lib/dates';
import type { Account, Budget, Category, Goal, Rule, Settings, TermDeposit, Transaction } from '../lib/types';
import * as sample from './sample';

export interface State {
  today: Date;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  rules: Rule[];
  termDeposits: TermDeposit[];
  goals: Goal[];
  budgets: Budget[];
  settings: Settings;
}

type Action =
  | { type: 'categorise'; id: string; categoryId: string; makeRule: boolean }
  | { type: 'addTransaction'; tx: Omit<Transaction, 'id'> }
  | { type: 'saveTermDeposit'; td: TermDeposit }
  | { type: 'deleteTermDeposit'; id: string }
  | { type: 'saveGoal'; goal: Goal }
  | { type: 'deleteGoal'; id: string }
  | { type: 'setBudget'; categoryId: string; amount: number }
  | { type: 'updateSettings'; settings: Partial<Settings> };

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

const upsert = <T extends { id: string }>(xs: T[], x: T) =>
  xs.some((y) => y.id === x.id) ? xs.map((y) => (y.id === x.id ? x : y)) : [...xs, x];

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'categorise': {
      const target = state.transactions.find((t) => t.id === action.id);
      if (!target) return state;
      let transactions = state.transactions.map((t) =>
        t.id === action.id ? { ...t, categoryId: action.categoryId } : t,
      );
      let rules = state.rules;
      if (action.makeRule) {
        const match = merchantKey(target.description);
        const rule = { id: newId('rule'), match, categoryId: action.categoryId };
        rules = [rule, ...rules.filter((r) => r.match.toLowerCase() !== match.toLowerCase())];
        transactions = applyRules(transactions, [rule]);
      }
      return { ...state, transactions, rules };
    }
    case 'addTransaction': {
      const tx = { ...action.tx, id: newId('tx') };
      const [categorised] = tx.categoryId ? [tx] : applyRules([tx], state.rules);
      const transactions = [categorised, ...state.transactions].sort((a, b) => b.date.localeCompare(a.date));
      const accounts = state.accounts.map((a) =>
        a.id === tx.accountId ? { ...a, balance: a.balance + tx.amount } : a,
      );
      return { ...state, transactions, accounts };
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
  }
}

function initialState(): State {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    today,
    accounts: sample.accounts,
    transactions: applyRules(sample.sampleTransactions(today), sample.rules),
    categories: sample.categories,
    rules: sample.rules,
    termDeposits: sample.sampleTermDeposits(today),
    goals: sample.sampleGoals(today),
    budgets: sample.budgets,
    settings: sample.defaultSettings(today),
  };
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}

export function useCategory(id: string | null | undefined) {
  const { state } = useStore();
  return state.categories.find((c) => c.id === id);
}

export const todayISO = (s: State) => toISO(s.today);
