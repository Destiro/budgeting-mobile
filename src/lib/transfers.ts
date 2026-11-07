import { TRANSFER_CATEGORY } from './analytics';
import { daysBetween, parseISO } from './dates';
import type { Transaction } from './types';

interface Candidate {
  t: Transaction;
  i: number;
}

/**
 * Finds movements of your own money between your accounts and cards, and tags both sides as
 * transfers so they are left out of income and spending.
 *
 * Two transactions are a transfer when they have the same amount, opposite signs, sit in
 * different accounts and are dated within `windowDays` of each other (ASB to BNZ can take a
 * day or two to arrive). This also catches credit card repayments: money out of an account and
 * the same amount onto the card.
 *
 * Only transactions that are uncategorised (or already marked as a transfer without a partner)
 * are considered, so categories you chose yourself are never overwritten. When several
 * candidates fit, the closest dates are paired first and each transaction is used once.
 */
export function matchTransfers(transactions: Transaction[], windowDays = 3): Transaction[] {
  const groups = new Map<number, { outs: Candidate[]; ins: Candidate[] }>();
  transactions.forEach((t, i) => {
    if (t.transferPairId) return;
    if (t.categoryId !== null && t.categoryId !== TRANSFER_CATEGORY) return;
    const cents = Math.round(Math.abs(t.amount) * 100);
    if (cents === 0) return;
    const g = groups.get(cents) ?? { outs: [], ins: [] };
    (t.amount < 0 ? g.outs : g.ins).push({ t, i });
    groups.set(cents, g);
  });

  const pairs: { out: Candidate; in: Candidate; diff: number }[] = [];
  for (const g of groups.values()) {
    for (const o of g.outs) {
      for (const n of g.ins) {
        if (o.t.accountId === n.t.accountId) continue;
        const diff = Math.abs(daysBetween(parseISO(o.t.date), parseISO(n.t.date)));
        if (diff <= windowDays) pairs.push({ out: o, in: n, diff });
      }
    }
  }
  pairs.sort((a, b) => a.diff - b.diff || a.out.i - b.out.i || a.in.i - b.in.i);

  const partner = new Map<number, number>();
  for (const p of pairs) {
    if (partner.has(p.out.i) || partner.has(p.in.i)) continue;
    partner.set(p.out.i, p.in.i);
    partner.set(p.in.i, p.out.i);
  }
  if (partner.size === 0) return transactions;

  return transactions.map((t, i) => {
    const j = partner.get(i);
    return j === undefined ? t : { ...t, categoryId: TRANSFER_CATEGORY, transferPairId: transactions[j].id };
  });
}
