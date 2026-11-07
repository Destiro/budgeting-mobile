import { looksLikePurchasesArePositive, parseAmount, parseBankCSV, parseCSV, parseDate, splitDuplicates } from '../csv';
import type { Transaction } from '../types';

// Layouts modelled on ASB's and BNZ's internet banking CSV exports.
const ASB = `Created date / time : 07 November 2026 / 10:15:32\r
Bank 12; Branch 3000; Account 0123456-50 (Streamline)\r
From date 20261001\r
To date 20261107\r
Avail Bal : 290.12 as of 20261107\r
Ledger Balance : 290.12 as of 20261107\r
Date,Unique Id,Tran Type,Cheque Number,Payee,Memo,Amount\r
\r
2026/11/06,2026110601,D/C,,"ACME LTD","SALARY",2410.00\r
2026/11/06,2026110602,TFR OUT,,"TRANSFER TO","RENT ACCOUNT",-720.00\r
2026/11/06,2026110603,TFR OUT,,"MB TRANSFER","TO 02-0100-0123456-00",-1500.00\r
`;

const BNZ = `Date,Amount,Payee,Particulars,Code,Reference,Tran Type,This Party Account,Other Party Account,Serial,Transaction Code,Batch Number,Originating Bank/Branch,Processed Date
07/11/26,1500.00,ACME PAY,ASB TRANSFER,,,AP,02-0100-0123456-00,12-3000-0123456-50,,,,,07/11/26
08/11/26,-450.00,Rapid Save,,,,TFR,02-0100-0123456-00,02-0100-0123456-01,,,,,08/11/26
08/11/26,-610.62,"Credit Card, BNZ",Payment,,,TFR,02-0100-0123456-00,,,,,,08/11/26
`;

describe('parseCSV', () => {
  it('handles quotes, embedded commas and newlines, escaped quotes and a BOM', () => {
    expect(parseCSV('﻿a,"b,c","say ""hi""","x\ny"\r\n1,2,3,4')).toEqual([
      ['a', 'b,c', 'say "hi"', 'x\ny'],
      ['1', '2', '3', '4'],
    ]);
  });
});

describe('parseDate / parseAmount', () => {
  it.each([
    ['2026/11/06', '2026-11-06'],
    ['2026-11-06', '2026-11-06'],
    ['06/11/2026', '2026-11-06'],
    ['6/11/26', '2026-11-06'],
    ['06 Nov 2026', '2026-11-06'],
    ['6-November-2026', '2026-11-06'],
    ['20261106', '2026-11-06'],
    ['31/02/2026', null],
    ['Date', null],
  ])('parseDate(%s) = %s', (input, expected) => expect(parseDate(input)).toBe(expected));

  it.each([
    ['-1,234.56', -1234.56],
    ['$12.00', 12],
    ['(12.50)', -12.5],
    ['12.00 DR', -12],
    ['12.00CR', 12],
    ['+5', 5],
    ['', null],
    ['abc', null],
  ])('parseAmount(%s) = %s', (input, expected) => expect(parseAmount(input)).toBe(expected));
});

describe('parseBankCSV', () => {
  it('reads an ASB export: skips the metadata, finds the balance, keeps the unique id', () => {
    const f = parseBankCSV(ASB);
    expect(f.format).toBe('ASB');
    expect(f.balance).toBe(290.12);
    expect(f.rows).toEqual([
      { date: '2026-11-06', amount: 2410, description: 'ACME LTD SALARY', externalId: '2026110601' },
      { date: '2026-11-06', amount: -720, description: 'TRANSFER TO RENT ACCOUNT', externalId: '2026110602' },
      { date: '2026-11-06', amount: -1500, description: 'MB TRANSFER TO 02-0100-0123456-00', externalId: '2026110603' },
    ]);
  });

  it('reads a BNZ export: dd/mm/yy dates and payee + particulars', () => {
    const f = parseBankCSV(BNZ);
    expect(f.format).toBe('BNZ');
    expect(f.rows.map((r) => [r.date, r.amount, r.description])).toEqual([
      ['2026-11-07', 1500, 'ACME PAY ASB TRANSFER'],
      ['2026-11-08', -450, 'Rapid Save'],
      ['2026-11-08', -610.62, 'Credit Card, BNZ Payment'],
    ]);
    expect(f.balance).toBeUndefined();
  });

  it('reads debit/credit columns and a running balance', () => {
    const f = parseBankCSV(
      'Transaction Date,Details,Debit,Credit,Balance\n05/11/2026,Coffee,4.50,,95.50\n06/11/2026,Refund,,10.00,105.50\n',
    );
    expect(f.rows.map((r) => r.amount)).toEqual([-4.5, 10]);
    expect(f.balance).toBe(105.5);
  });

  it('counts rows it could not read and explains a missing header', () => {
    expect(parseBankCSV('Date,Amount,Payee\n06/11/2026,oops,X\n07/11/2026,5,Y\n').skipped).toBe(1);
    expect(() => parseBankCSV('just,some,text\n1,2,3')).toThrow(/header row/);
  });
});

describe('credit card sign', () => {
  it('spots exports that show purchases as positive', () => {
    expect(looksLikePurchasesArePositive([{ date: 'x', amount: 5, description: '' }, { date: 'x', amount: 9, description: '' }])).toBe(true);
    expect(looksLikePurchasesArePositive([{ date: 'x', amount: -5, description: '' }, { date: 'x', amount: 9, description: '' }])).toBe(false);
  });
});

describe('splitDuplicates', () => {
  const existing: Transaction[] = [
    { id: '1', accountId: 'a', date: '2026-11-06', amount: -4.5, description: 'Coffee', categoryId: null },
    { id: '2', accountId: 'a', date: '2026-11-06', amount: 10, description: 'X', categoryId: null, externalId: 'U1' },
    { id: '3', accountId: 'b', date: '2026-11-07', amount: -9, description: 'Other account', categoryId: null },
  ];

  it('skips rows already imported into the same account, keeping genuine repeats', () => {
    const { fresh, duplicates } = splitDuplicates(
      [
        { date: '2026-11-06', amount: -4.5, description: 'COFFEE' }, // already there
        { date: '2026-11-06', amount: -4.5, description: 'Coffee' }, // a second coffee that day
        { date: '2026-11-06', amount: 10, description: 'renamed', externalId: 'U1' }, // same bank id
        { date: '2026-11-07', amount: -9, description: 'Other account' }, // exists, but in another account
      ],
      existing,
      'a',
    );
    expect(duplicates).toBe(2);
    expect(fresh.map((r) => r.description)).toEqual(['Coffee', 'Other account']);
  });
});
