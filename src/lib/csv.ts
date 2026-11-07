/**
 * Bank CSV import.
 *
 * Bank export layouts change over time, so rather than hard-coding one layout this finds the
 * header row (a row with a Date column and an Amount, or Debit/Credit, column), maps the columns
 * by name, and builds a description from whatever payee/memo/particulars columns exist.
 * It handles ASB's export (metadata lines on top, "Unique Id", "Payee", "Memo") and BNZ's
 * ("Payee", "Particulars", "Code", "Reference"), plus most generic CSVs.
 */
import { parseISO, toISO } from './dates';
import type { Transaction } from './types';

export interface ParsedRow {
  date: string;
  amount: number;
  description: string;
  externalId?: string;
}

export interface ParsedFile {
  format: 'ASB' | 'BNZ' | 'CSV';
  rows: ParsedRow[];
  /** Balance stated in the file, when there is one */
  balance?: number;
  /** Rows that had a date but no readable amount, or the reverse */
  skipped: number;
}

export class CsvError extends Error {}

/** Splits CSV text into rows of cells: quotes, escaped quotes, commas and newlines inside quotes, CRLF, BOM. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** NZ-style dates: 2026/11/06, 2026-11-06, 06/11/2026, 6/11/26, 06 Nov 2026, 20261106. Day before month. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if ((r = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/))) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/))) [d, m, y] = [+r[1], +r[2], +r[3]];
  else if ((r = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[A-Za-z]*[ -](\d{2,4})\b/))) {
    const mm = MONTHS[r[2].toLowerCase()];
    if (!mm) return null;
    [d, m, y] = [+r[1], mm, +r[3]];
  } else if ((r = s.match(/^(\d{4})(\d{2})(\d{2})$/))) [y, m, d] = [+r[1], +r[2], +r[3]];
  else return null;
  if (y < 100) y += 2000;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return toISO(parseISO(iso)) === iso ? iso : null;
}

/** "-1,234.56", "$12.00", "(12.00)", "12.00 DR", "+5" → number. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[$,\s]/g, '');
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  const suffix = s.match(/(DR|CR)$/i);
  if (suffix) {
    if (suffix[1].toUpperCase() === 'DR') sign = -sign;
    s = s.slice(0, -2);
  }
  if (!/^[+-]?\d*\.?\d+$/.test(s)) return null;
  return Math.round(sign * Number(s) * 100) / 100;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');

function findCol(headers: string[], names: string[]): number {
  for (const n of names) {
    const i = headers.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

export function parseBankCSV(text: string): ParsedFile {
  const rows = parseCSV(text);
  const headerIdx = rows.findIndex((r) => {
    const h = r.map(norm);
    return h.some((c) => c.includes('date')) && (h.includes('amount') || h.some((c) => /debit|credit|withdrawal|deposit/.test(c)));
  });
  if (headerIdx < 0) {
    throw new CsvError("Couldn't find a header row with Date and Amount columns. Export the transactions as CSV and try again.");
  }
  const headers = rows[headerIdx].map(norm);

  const dateCol = findCol(headers, ['date of transaction', 'transaction date', 'date', 'processed date', 'date processed']);
  const amountCol = findCol(headers, ['amount', 'amount (nzd)', 'transaction amount']);
  const debitCol = headers.findIndex((h) => /debit|withdrawal/.test(h));
  const creditCol = headers.findIndex((h) => /credit|deposit/.test(h) && !/credit card/.test(h));
  const mainCols = ['payee', 'description', 'details', 'narrative', 'transaction details', 'merchant']
    .map((n) => headers.indexOf(n))
    .filter((i) => i >= 0);
  const extraCols = ['memo', 'particulars', 'code', 'reference', 'analysis code']
    .map((n) => headers.indexOf(n))
    .filter((i) => i >= 0);
  const typeCol = findCol(headers, ['tran type', 'transaction type', 'type']);
  const idCol = findCol(headers, ['unique id', 'transaction id', 'id']);
  const balanceCol = findCol(headers, ['balance', 'running balance']);

  const format: ParsedFile['format'] = headers.includes('unique id')
    ? 'ASB'
    : headers.includes('particulars') || headers.includes('this party account')
      ? 'BNZ'
      : 'CSV';

  const parsed: (ParsedRow & { balance?: number })[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const cell = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const date = parseDate(cell(dateCol));
    let amount: number | null = null;
    if (amountCol >= 0) amount = parseAmount(cell(amountCol));
    else {
      const debit = parseAmount(cell(debitCol));
      const credit = parseAmount(cell(creditCol));
      if (debit !== null || credit !== null) amount = (credit ?? 0) - Math.abs(debit ?? 0);
    }
    if (!date || amount === null) {
      if (date || amount !== null) skipped++;
      continue;
    }
    const pieces: string[] = [];
    for (const i of [...mainCols, ...extraCols]) {
      const v = cell(i).replace(/\s+/g, ' ');
      if (v && !pieces.some((p) => p.toLowerCase() === v.toLowerCase())) pieces.push(v);
    }
    const description = pieces.join(' ') || cell(typeCol) || 'Transaction';
    const externalId = cell(idCol) || undefined;
    const bal = balanceCol >= 0 ? parseAmount(cell(balanceCol)) : null;
    parsed.push({ date, amount, description, externalId, ...(bal !== null ? { balance: bal } : {}) });
  }

  // A balance stated above the header (ASB: "Ledger Balance : 864.52 as of ..."), or the newest row's balance column.
  let balance: number | undefined;
  for (const r of rows.slice(0, headerIdx)) {
    const m = r.join(',').match(/(ledger balance|avail(?:able)? bal(?:ance)?|closing balance)\s*:?\s*(-?\$?[\d,]+\.\d{2})/i);
    if (m) {
      const v = parseAmount(m[2]);
      if (v !== null && (balance === undefined || /ledger|closing/i.test(m[1]))) balance = v;
    }
  }
  if (balance === undefined && parsed.some((p) => p.balance !== undefined)) {
    const newestFirst = parsed.length > 1 && parsed[0].date > parsed[parsed.length - 1].date;
    const ordered = newestFirst ? parsed : [...parsed].reverse();
    balance = ordered.find((p) => p.balance !== undefined)?.balance;
  }

  return { format, rows: parsed.map(({ balance: _b, ...p }) => p), balance, skipped };
}

/** Credit card exports differ in sign. If most rows are positive, purchases are probably shown as positive. */
export function looksLikePurchasesArePositive(rows: ParsedRow[]): boolean {
  if (!rows.length) return false;
  return rows.filter((r) => r.amount > 0).length > rows.length / 2;
}

const dupKey = (date: string, amount: number, description: string) =>
  `${date}|${Math.round(amount * 100)}|${description.toLowerCase().replace(/\s+/g, ' ').trim()}`;

/**
 * Splits rows into new ones and ones already in the account, so importing an overlapping
 * date range twice is safe. Uses the bank's transaction id when there is one; otherwise date,
 * amount and description, counted, so two identical coffees on the same day are both kept.
 */
export function splitDuplicates(rows: ParsedRow[], existing: Transaction[], accountId: string) {
  const mine = existing.filter((t) => t.accountId === accountId);
  const ids = new Set(mine.map((t) => t.externalId).filter(Boolean));
  const counts = new Map<string, number>();
  for (const t of mine) {
    const k = dupKey(t.date, t.amount, t.description);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const fresh: ParsedRow[] = [];
  let duplicates = 0;
  for (const r of rows) {
    if (r.externalId && ids.has(r.externalId)) {
      duplicates++;
      continue;
    }
    const k = dupKey(r.date, r.amount, r.description);
    const n = counts.get(k) ?? 0;
    if (n > 0) {
      counts.set(k, n - 1);
      duplicates++;
    } else fresh.push(r);
  }
  return { fresh, duplicates };
}
