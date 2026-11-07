/**
 * Demo data so every screen has something to show before a bank is connected.
 * Generated relative to `today` with a seeded random, so it is the same on every launch.
 *
 * It follows one payday flow:
 *   pay → ASB pay account → ASB rent account (rent paid from there)
 *                         → BNZ everyday → BNZ Rapid Save (savings)
 *                                        → BNZ credit card (repayment)
 * with most day-to-day spending on the BNZ credit card.
 *
 * Transfers are generated with no category on purpose: the app's transfer matching finds them.
 */
import { addDays, addMonths, daysBetween, toISO } from '../lib/dates';
import { roundCents } from '../lib/money';
import type { Account, Budget, Category, Goal, Rule, Settings, TermDeposit, Transaction } from '../lib/types';

export const categories: Category[] = [
  { id: 'income', name: 'Income', emoji: '💰', group: 'income' },
  { id: 'rent', name: 'Rent', emoji: '🏠', group: 'essentials' },
  { id: 'groceries', name: 'Groceries', emoji: '🛒', group: 'essentials' },
  { id: 'transport', name: 'Transport', emoji: '🚗', group: 'essentials' },
  { id: 'health', name: 'Health', emoji: '💊', group: 'essentials' },
  { id: 'eating-out', name: 'Eating out', emoji: '🍔', group: 'lifestyle' },
  { id: 'fun', name: 'Fun', emoji: '🎉', group: 'lifestyle' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', group: 'lifestyle' },
  { id: 'bills', name: 'Bills', emoji: '💡', group: 'bills' },
  { id: 'subscriptions', name: 'Subscriptions', emoji: '📺', group: 'bills' },
  { id: 'transfer', name: 'Transfer', emoji: '🔁', group: 'transfer' },
];

export const accounts: Account[] = [
  { id: 'asb-pay', bank: 'ASB', name: 'Pay account', type: 'everyday', balance: 290.12, source: 'manual' },
  { id: 'asb-rent', bank: 'ASB', name: 'Rent account', type: 'everyday', balance: 85.4, source: 'manual' },
  { id: 'bnz-everyday', bank: 'BNZ', name: 'Everyday', type: 'everyday', balance: 1240.18, source: 'manual' },
  { id: 'bnz-savings', bank: 'BNZ', name: 'Rapid Save', type: 'savings', balance: 2600, interestRate: 0.03, source: 'manual' },
  { id: 'bnz-credit', bank: 'BNZ', name: 'Credit Card', type: 'credit', balance: -624.3, source: 'manual' },
  { id: 'kiwisaver', bank: 'Other', name: 'KiwiSaver', type: 'kiwisaver', balance: 18400, source: 'manual' },
];

/** Payday is a Friday; this is the most recent one on or before `today`. */
export const lastPayday = (today: Date) => addDays(today, -((today.getDay() + 2) % 7));

export const defaultSettings = (today: Date): Settings => ({
  rwt: 0.3,
  budgetPeriod: 'fortnightly',
  paydayAnchor: toISO(lastPayday(today)),
});

export const budgets: Budget[] = [
  { categoryId: 'groceries', amount: 400 },
  { categoryId: 'eating-out', amount: 150 },
  { categoryId: 'transport', amount: 160 },
  { categoryId: 'fun', amount: 120 },
  { categoryId: 'shopping', amount: 100 },
];

export const rules: Rule[] = [
  { id: 'r1', match: 'COUNTDOWN', categoryId: 'groceries' },
  { id: 'r2', match: "PAK'NSAVE", categoryId: 'groceries' },
  { id: 'r3', match: 'NEW WORLD', categoryId: 'groceries' },
  { id: 'r4', match: 'Z ENERGY', categoryId: 'transport' },
  { id: 'r5', match: 'AT HOP', categoryId: 'transport' },
  { id: 'r6', match: 'NETFLIX', categoryId: 'subscriptions' },
  { id: 'r7', match: 'SPOTIFY', categoryId: 'subscriptions' },
  { id: 'r8', match: 'MERCURY', categoryId: 'bills' },
  { id: 'r9', match: 'ONE NZ', categoryId: 'bills' },
  { id: 'r10', match: 'SALARY', categoryId: 'income' },
  { id: 'r11', match: 'RENT J SMITH', categoryId: 'rent' },
];

export function sampleGoals(today: Date): Goal[] {
  return [
    {
      id: 'house',
      name: 'House deposit',
      emoji: '🏠',
      target: 30000,
      targetDate: toISO(addMonths(today, 22)),
      monthlyContribution: 900,
      // Savings grow by whatever is moved into Rapid Save each payday.
      autoContribution: true,
      accountIds: ['bnz-savings'],
    },
  ];
}

export function sampleTermDeposits(today: Date): TermDeposit[] {
  return [
    {
      id: 'td-bnz',
      bank: 'BNZ',
      principal: 10000,
      rate: 0.046,
      startDate: toISO(addDays(addMonths(today, -8), 7)),
      termMonths: 12,
      interestFrequency: 'maturity',
      onMaturity: 'reinvest',
      goalId: 'house',
    },
    {
      id: 'td-asb',
      bank: 'ASB',
      principal: 15000,
      rate: 0.0435,
      startDate: toISO(addDays(addMonths(today, -6), 25)),
      termMonths: 6,
      interestFrequency: 'maturity',
      onMaturity: 'payout',
    },
  ];
}

/** Mulberry32: a tiny seeded PRNG so demo data is stable. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleTransactions(today: Date): Transaction[] {
  const rand = rng(42);
  const between = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100) / 100;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const out: Transaction[] = [];
  let n = 0;

  const add = (d: Date, accountId: string, amount: number, description: string, categoryId: string | null) => {
    out.push({ id: `tx${++n}`, accountId, date: toISO(d), amount: roundCents(amount), description, categoryId });
  };

  /** Moves money between two of your accounts. Neither side is categorised; matching finds them. */
  const move = (d: Date, from: string, to: string, amount: number, outDesc: string, inDesc: string, lagDays = 0) => {
    const arrives = addDays(d, lagDays);
    if (arrives > today) return false; // still in transit, so leave both sides out
    add(d, from, -amount, outDesc, null);
    add(arrives, to, amount, inDesc, null);
    return true;
  };

  let cardOwing = 0;
  const onCard = (d: Date, amount: number, description: string, categoryId: string | null) => {
    add(d, 'bnz-credit', -amount, description, categoryId);
    cardOwing = roundCents(cardOwing + amount);
  };

  const payday = lastPayday(today);
  for (let d = addMonths(today, -6); d <= today; d = addDays(d, 1)) {
    const dow = d.getDay();
    const dom = d.getDate();
    /** 0 on payday, 1 the day after, and so on through the fortnight */
    const k = ((daysBetween(payday, d) % 14) + 14) % 14;

    if (k === 0) {
      add(d, 'asb-pay', 2410, 'ACME LTD SALARY', 'income');
      // Rent money goes to the rent account, and the rent is paid from there.
      if (move(d, 'asb-pay', 'asb-rent', 720, 'TRANSFER TO RENT ACCOUNT', 'TRANSFER FROM PAY ACCOUNT')) {
        add(d, 'asb-rent', -720, 'RENT J SMITH', 'rent');
      }
      // The rest goes across to BNZ, arriving the next day.
      move(d, 'asb-pay', 'bnz-everyday', 1500, 'TRANSFER TO BNZ EVERYDAY', 'ASB ACME PAY TRANSFER', 1);
    }

    // Day-to-day spending is mostly on the BNZ credit card.
    if (dow === 6 || (dow === 3 && rand() < 0.4)) {
      const shop = pick(['COUNTDOWN PONSONBY', "PAK'NSAVE ALBANY", 'NEW WORLD VICTORIA PARK']);
      onCard(d, between(45, 165), shop, 'groceries');
    }
    if (rand() < 0.22) {
      const place = pick(['UBER *EATS', 'BURGERFUEL K RD', 'ODETTES EATERY', 'CHICKEN CHOP SHOP', 'DEVONPORT CAFE']);
      onCard(d, between(12, 62), place, 'eating-out');
    }
    if (dow === 4 && rand() < 0.6) onCard(d, between(58, 92), 'Z ENERGY GREY LYNN', 'transport');
    if (dow === 2 && rand() < 0.5) onCard(d, 20, 'AT HOP TOP UP', 'transport');
    if (rand() < 0.06) onCard(d, between(20, 140), pick(['THE WAREHOUSE', 'KMART SYLVIA PARK', 'REBEL SPORT']), 'shopping');
    if (rand() < 0.05) onCard(d, between(18, 80), pick(['EVENT CINEMAS', 'TICKETMASTER NZ', 'LEISURE CENTRE']), 'fun');
    if (rand() < 0.02) onCard(d, between(15, 60), 'UNICHEM PHARMACY', 'health');
    if (dom === 18) onCard(d, 25.99, 'NETFLIX.COM', 'subscriptions');
    if (dom === 3) onCard(d, 19.99, 'SPOTIFY P3B1', 'subscriptions');

    // A couple of bills come straight out of BNZ everyday.
    if (dom === 14) add(d, 'bnz-everyday', -between(132, 178), 'MERCURY ENERGY', 'bills');
    if (dom === 20) add(d, 'bnz-everyday', -65, 'ONE NZ MOBILE', 'bills');

    // Two days after payday: save, then pay off the card.
    if (k === 2) {
      move(d, 'bnz-everyday', 'bnz-savings', 450, 'TRANSFER TO RAPID SAVE', 'TRANSFER FROM EVERYDAY');
      if (cardOwing > 0 && move(d, 'bnz-everyday', 'bnz-credit', cardOwing, 'CREDIT CARD PAYMENT', 'PAYMENT RECEIVED - THANK YOU')) {
        cardOwing = 0;
      }
    }
  }

  // A few recent ones left uncategorised so there's something to sort.
  onCard(addDays(today, -1), 38.5, 'UBER *EATS 4821', null);
  onCard(addDays(today, -2), 64.0, 'LOBSTER SEAFOOD CO', null);
  add(addDays(today, -3), 'bnz-everyday', -12.5, 'POS W/D 0921 PARKING', null);

  const seq = (t: Transaction) => Number(t.id.slice(2));
  return out.sort((a, b) => b.date.localeCompare(a.date) || seq(b) - seq(a));
}
