import { addDays, addMonths, daysBetween, parseISO, startOfMonth } from './dates';
import type { Account, Category, Rule, Settings, TermDeposit, Transaction } from './types';

export const TRANSFER_CATEGORY = 'transfer';

/** Transfers between your own accounts are not income or spending. */
export const isTransfer = (t: Transaction) => t.categoryId === TRANSFER_CATEGORY;

export interface MonthFlow {
  month: Date;
  in: number;
  out: number;
}

/** Money in/out for each of the last `months` calendar months (oldest first), including the current one. */
export function monthlyCashFlow(transactions: Transaction[], months: number, today: Date): MonthFlow[] {
  const first = addMonths(startOfMonth(today), -(months - 1));
  const buckets: MonthFlow[] = Array.from({ length: months }, (_, i) => ({
    month: addMonths(first, i),
    in: 0,
    out: 0,
  }));
  for (const t of transactions) {
    if (isTransfer(t)) continue;
    const d = parseISO(t.date);
    const i = (d.getFullYear() - first.getFullYear()) * 12 + d.getMonth() - first.getMonth();
    if (i < 0 || i >= months) continue;
    if (t.amount >= 0) buckets[i].in += t.amount;
    else buckets[i].out += -t.amount;
  }
  return buckets;
}

export interface Period {
  start: Date;
  /** Exclusive */
  end: Date;
}

/** The budget period containing `today`: a calendar month, or a pay cycle aligned to the payday anchor. */
export function currentPeriod(settings: Settings, today: Date): Period {
  if (settings.budgetPeriod === 'monthly') {
    const start = startOfMonth(today);
    return { start, end: addMonths(start, 1) };
  }
  const len = settings.budgetPeriod === 'weekly' ? 7 : 14;
  const anchor = parseISO(settings.paydayAnchor);
  const offset = ((daysBetween(anchor, today) % len) + len) % len;
  const start = addDays(today, -offset);
  return { start: new Date(start.getFullYear(), start.getMonth(), start.getDate()), end: addDays(start, len) };
}

export function inPeriod(t: Transaction, p: Period): boolean {
  const d = parseISO(t.date);
  return d >= p.start && d < p.end;
}

/** Spending (positive numbers) per category id within a period. Uncategorised spend is keyed under null. */
export function spendByCategory(transactions: Transaction[], p: Period): Map<string | null, number> {
  const m = new Map<string | null, number>();
  for (const t of transactions) {
    if (t.amount >= 0 || isTransfer(t) || !inPeriod(t, p)) continue;
    m.set(t.categoryId, (m.get(t.categoryId) ?? 0) - t.amount);
  }
  return m;
}

/** Totals per category group (essentials, lifestyle, bills…) for a period, for the cash-flow breakdown. */
export function spendByGroup(transactions: Transaction[], categories: Category[], p: Period) {
  const groupOf = new Map(categories.map((c) => [c.id, c.group]));
  const totals: Record<string, number> = {};
  for (const [catId, amount] of spendByCategory(transactions, p)) {
    const g = (catId && groupOf.get(catId)) || 'uncategorised';
    totals[g] = (totals[g] ?? 0) + amount;
  }
  return totals;
}

export function netWorth(accounts: Account[], tds: TermDeposit[]): number {
  return accounts.reduce((s, a) => s + a.balance, 0) + tds.reduce((s, t) => s + t.principal, 0);
}

/**
 * Month-end net worth for the last `months` months, worked backwards from today's balances
 * by undoing each later transaction. TD and KiwiSaver balances are treated as constant.
 */
export function netWorthHistory(
  accounts: Account[],
  tds: TermDeposit[],
  transactions: Transaction[],
  months: number,
  today: Date,
): { date: Date; value: number }[] {
  const now = netWorth(accounts, tds);
  const points: { date: Date; value: number }[] = [];
  for (let i = months - 1; i >= 1; i--) {
    const monthEnd = startOfMonth(addMonths(today, -i + 1));
    const after = transactions
      .filter((t) => !isTransfer(t) && parseISO(t.date) >= monthEnd)
      .reduce((s, t) => s + t.amount, 0);
    points.push({ date: monthEnd, value: now - after });
  }
  points.push({ date: today, value: now });
  return points;
}

/** First rule whose text appears in the description (case-insensitive). */
export function matchRule(description: string, rules: Rule[]): Rule | undefined {
  const d = description.toLowerCase();
  return rules.find((r) => d.includes(r.match.toLowerCase()));
}

export function applyRules(transactions: Transaction[], rules: Rule[]): Transaction[] {
  return transactions.map((t) => {
    if (t.categoryId) return t;
    const r = matchRule(t.description, rules);
    return r ? { ...t, categoryId: r.categoryId } : t;
  });
}

/** A short, stable text to match future transactions from the same merchant ("UBER *EATS 1234" → "UBER *EATS"). */
export function merchantKey(description: string): string {
  return description
    .replace(/\d{3,}.*$/, '')
    .replace(/\s+(AUCKLAND|WELLINGTON|CHRISTCHURCH|NZ)\b.*$/i, '')
    .trim();
}
