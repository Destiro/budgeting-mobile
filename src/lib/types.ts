export type Bank = 'BNZ' | 'ASB' | 'Other';
export type AccountType = 'everyday' | 'savings' | 'credit' | 'kiwisaver';

export interface Account {
  id: string;
  bank: Bank;
  name: string;
  type: AccountType;
  balance: number;
  /** Annual interest rate as a decimal, e.g. 0.03 for 3% */
  interestRate?: number;
  source: 'akahu' | 'csv' | 'manual';
}

export type CategoryGroup = 'income' | 'essentials' | 'lifestyle' | 'bills' | 'transfer';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  group: CategoryGroup;
}

export interface Transaction {
  id: string;
  accountId: string;
  /** ISO date, yyyy-mm-dd */
  date: string;
  /** Negative = money out */
  amount: number;
  description: string;
  categoryId: string | null;
}

export interface Rule {
  id: string;
  /** Case-insensitive substring matched against the description */
  match: string;
  categoryId: string;
}

export type InterestFrequency = 'maturity' | 'monthly' | 'quarterly';

export interface TermDeposit {
  id: string;
  bank: Bank;
  principal: number;
  /** Annual rate as a decimal */
  rate: number;
  startDate: string;
  termMonths: number;
  interestFrequency: InterestFrequency;
  onMaturity: 'reinvest' | 'payout';
  /** Rate assumed when reinvesting; defaults to the current rate */
  rolloverRate?: number;
  goalId?: string;
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  targetDate: string;
  monthlyContribution: number;
  /** Savings accounts whose balances count towards this goal */
  accountIds: string[];
}

export interface Budget {
  categoryId: string;
  /** Amount per budget period */
  amount: number;
}

export type BudgetPeriod = 'monthly' | 'fortnightly' | 'weekly';

export interface Settings {
  /** Resident withholding tax rate as a decimal */
  rwt: number;
  budgetPeriod: BudgetPeriod;
  /** A known payday, used to align weekly/fortnightly periods */
  paydayAnchor: string;
}
