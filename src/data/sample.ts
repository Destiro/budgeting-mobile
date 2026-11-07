/**
 * Demo data so every screen has something to show before a bank is connected.
 * Generated relative to `today` with a seeded random, so it is the same on every launch.
 */
import { addDays, addMonths, toISO } from '../lib/dates';
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
  { id: 'bnz-everyday', bank: 'BNZ', name: 'Everyday', type: 'everyday', balance: 1240.18, source: 'manual' },
  { id: 'bnz-rapid', bank: 'BNZ', name: 'Rapid Save', type: 'savings', balance: 2600, interestRate: 0.03, source: 'manual' },
  { id: 'asb-streamline', bank: 'ASB', name: 'Streamline', type: 'everyday', balance: 864.52, source: 'manual' },
  { id: 'asb-savings', bank: 'ASB', name: 'Savings Plus', type: 'savings', balance: 720, interestRate: 0.025, source: 'manual' },
  { id: 'asb-visa', bank: 'ASB', name: 'Visa Light', type: 'credit', balance: -624.3, source: 'manual' },
  { id: 'kiwisaver', bank: 'Other', name: 'KiwiSaver', type: 'kiwisaver', balance: 18400, source: 'manual' },
];

export const defaultSettings = (today: Date): Settings => ({
  rwt: 0.3,
  budgetPeriod: 'fortnightly',
  // Payday is the most recent Friday.
  paydayAnchor: toISO(addDays(today, -((today.getDay() + 2) % 7))),
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
      accountIds: ['bnz-rapid'],
    },
    {
      id: 'japan',
      name: 'Japan trip',
      emoji: '✈️',
      target: 4000,
      targetDate: toISO(addMonths(today, 7)),
      monthlyContribution: 400,
      accountIds: ['asb-savings'],
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
    if (d > today) return;
    out.push({ id: `tx${++n}`, accountId, date: toISO(d), amount, description, categoryId });
  };

  const start = addMonths(today, -6);
  const lastFriday = addDays(today, -((today.getDay() + 2) % 7));
  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const dow = d.getDay();
    const dom = d.getDate();
    const sinceFriday = Math.round((+lastFriday - +d) / 86_400_000);
    const isPayday = dow === 5 && sinceFriday % 14 === 0;

    if (isPayday) {
      add(d, 'asb-streamline', 2410, 'ACME LTD SALARY', 'income');
      add(d, 'asb-streamline', -1300, 'TRANSFER TO BNZ EVERYDAY', 'transfer');
      add(d, 'bnz-everyday', 1300, 'TRANSFER FROM ASB STREAMLINE', 'transfer');
    }
    if (dow === 1) add(d, 'bnz-everyday', -310, 'RENT J SMITH', 'rent');
    if (dow === 6 || (dow === 3 && rand() < 0.4)) {
      const shop = pick(['COUNTDOWN PONSONBY', "PAK'NSAVE ALBANY", 'NEW WORLD VICTORIA PARK']);
      add(d, 'asb-visa', -between(45, 165), shop, 'groceries');
    }
    if (rand() < 0.22) {
      const place = pick(['UBER *EATS', 'BURGERFUEL K RD', 'ODETTES EATERY', 'CHICKEN CHOP SHOP', 'DEVONPORT CAFE']);
      add(d, 'asb-visa', -between(12, 62), place, 'eating-out');
    }
    if (dow === 4 && rand() < 0.6) add(d, 'bnz-everyday', -between(58, 92), 'Z ENERGY GREY LYNN', 'transport');
    if (dow === 2 && rand() < 0.5) add(d, 'bnz-everyday', -20, 'AT HOP TOP UP', 'transport');
    if (rand() < 0.06) add(d, 'asb-visa', -between(20, 140), pick(['THE WAREHOUSE', 'KMART SYLVIA PARK', 'REBEL SPORT']), 'shopping');
    if (rand() < 0.05) add(d, 'asb-visa', -between(18, 80), pick(['EVENT CINEMAS', 'TICKETMASTER NZ', 'LEISURE CENTRE']), 'fun');
    if (rand() < 0.02) add(d, 'bnz-everyday', -between(15, 60), 'UNICHEM PHARMACY', 'health');

    if (dom === 14) add(d, 'bnz-everyday', -between(132, 178), 'MERCURY ENERGY', 'bills');
    if (dom === 20) add(d, 'bnz-everyday', -65, 'ONE NZ MOBILE', 'bills');
    if (dom === 18) add(d, 'asb-visa', -25.99, 'NETFLIX.COM', 'subscriptions');
    if (dom === 3) add(d, 'asb-visa', -19.99, 'SPOTIFY P3B1', 'subscriptions');
    if (dom === 1) {
      add(d, 'bnz-everyday', -900, 'TRANSFER TO RAPID SAVE', 'transfer');
      add(d, 'bnz-rapid', 900, 'TRANSFER FROM EVERYDAY', 'transfer');
    }
    if (dom === 25) {
      add(d, 'asb-streamline', -600, 'VISA PAYMENT', 'transfer');
      add(d, 'asb-visa', 600, 'PAYMENT RECEIVED', 'transfer');
    }
  }

  // A few recent ones left uncategorised so there's something to sort.
  add(addDays(today, -1), 'asb-visa', -38.5, 'UBER *EATS 4821', null);
  add(addDays(today, -2), 'asb-visa', -64.0, 'LOBSTER SEAFOOD CO', null);
  add(addDays(today, -3), 'bnz-everyday', -12.5, 'POS W/D 0921 PARKING', null);

  return out.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
