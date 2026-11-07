# Budgeting app: design

> Working name: **Kōwhai** (placeholder; rename freely)
> Currency: NZD · Banks: BNZ, ASB · Platform: iOS + Android

---

## 1. Goals

| # | You asked for | What the app does |
|---|---|---|
| 1 | Track cash flow | Money in vs. out per pay cycle / month, with a running "safe to spend" figure |
| 2 | Understand spending | Auto-categorised transactions, category breakdowns, month-on-month trends |
| 3 | Forecast savings to a goal | Projected balance line and an "on track for <date>" estimate per goal |
| 4 | Include term deposits | TDs are linked to goals; their interest (after RWT) and maturity dates feed the forecast |

---

## 2. Getting the bank data in

BNZ and ASB both work with **[Akahu](https://www.akahu.nz)**, NZ's open-banking aggregator. Akahu offers free **personal app tokens** for your own accounts, which suits a personal app.

| Option | Pros | Cons |
|---|---|---|
| **A. Akahu sync (recommended)** | Automatic, near-real-time, balances and transactions, includes merchant and category hints | You have to set up a personal Akahu app (one-off, about 10 minutes) |
| **B. CSV import** | No third party; BNZ and ASB internet banking both export CSV | Manual, and each bank's CSV format differs |
| **C. Both** | Akahu day to day, CSV to backfill older history | More code |

Recommendation: start with **C**. CSV import is quick to build and gets history in; Akahu is added next.

Transfers between your own accounts (for example ASB everyday to BNZ savings) are detected and **excluded from spending**, so they don't double-count.

---

## 3. Feature list

### Core (v1): what you asked for
1. **Accounts:** BNZ and ASB everyday, savings, credit card, plus term deposits entered manually
2. **Transactions:** a searchable list, auto-categorisation, editable categories, "always categorise X as Y" rules
3. **Cash flow:** in vs. out per month or pay cycle, net position, and the trend over 6 to 12 months
4. **Spending insights:** category breakdown, top merchants, "you spent 23% more on eating out than usual"
5. **Goals:** target amount and date, linked accounts and TDs, monthly contribution, projected finish date
6. **Term deposits:** principal, rate, term, start date, interest frequency (at maturity, monthly, or quarterly), RWT rate, and what happens at maturity (reinvest or pay to an account)
7. **Forecast:** a projection chart per goal, showing contributions plus savings interest plus TD interest

### Ideas you might want (pick any)
| Idea | Why it's useful |
|---|---|
| **Pay-cycle budgeting** (weekly or fortnightly) | NZ pay is often fortnightly; budgets line up with paydays instead of calendar months |
| **Category budgets with rollover** | For example $600/month on groceries, with unspent money carrying over |
| **Bills and subscriptions detector** | Finds recurring charges (Netflix, power, phone) and shows a bills calendar |
| **"Safe to spend" number** | Balance minus upcoming bills minus goal contributions until next payday |
| **TD maturity reminders and rate compare** | A notification 7 days before maturity, with current BNZ and ASB rates for comparison |
| **What-if scenarios** | "If I save $50/wk more" or "if I roll the TD at 4.9%": see the goal date move |
| **Net worth** | Accounts plus TDs plus KiwiSaver minus credit cards and loans, over time |
| **KiwiSaver tracking** | Manual balance plus contributions, or an optional separate retirement goal |
| **Multiple goals with priority** | Surplus flows to goal 1, then goal 2 (for example emergency fund, then a house deposit) |
| **Split transactions** | Split one Countdown shop into groceries and household |
| **Shared or partner mode** | Shared goals and categories with a partner |
| **Spending alerts** | "You've hit 80% of your eating-out budget" |
| **Home-screen widget** | Safe to spend, plus goal progress |
| **Face ID / PIN lock** | It's financial data |

---

## 4. Forecasting maths

Monthly simulation from today until the goal is reached (or 10 years out, whichever comes first).

For each month `m`:

```
savings_balance[m+1] = savings_balance[m]
                     + planned_contribution
                     + savings_balance[m] × (savings_rate / 12) × (1 − RWT)

for each TD linked to the goal:
    if interest is paid periodically (monthly or quarterly) and this is a payment month:
        interest = principal × rate × days_in_period / 365 × (1 − RWT)
        → added to the payout account (or compounded if the TD compounds)
    if the TD matures this month:
        interest = principal × rate × term_days / 365 × (1 − RWT)   (at-maturity TDs)
        if reinvest: new TD with principal (+ interest if compounding) at the assumed rollover rate
        else: principal + interest moves into savings_balance

goal_value[m] = savings_balance[m] + Σ TD principal (+ accrued interest, shown separately)
```

- **RWT:** you pick your rate (10.5%, 17.5%, 30%, 33% or 39%) once in settings, and it is applied to all interest.
- **"On track" date:** the first month where `goal_value ≥ target`.
- **Required contribution:** solve for the monthly amount that hits the target by the target date (binary search over the simulation).
- **Contribution source:** either a fixed amount, or "my average monthly surplus over the last 3 months" taken from cash flow.
- The chart stacks **what you've saved**, **contributions**, and **interest earned** so you can see how much the TDs are doing.

### Worked example
Goal: $30,000 by Dec 2027. Current: $8,000 savings (3.0%) + $10,000 TD (4.6%, 12 months, at maturity, matures Mar 2027). Saving $900/month, RWT 30%.
TD interest = 10,000 × 4.6% × 0.7 = **$322** at maturity. The forecast reaches $30k around **Sep 2027**, ahead of target.

---

## 5. Data model (local SQLite)

```
Account        id, bank(BNZ|ASB|Other), name, type(everyday|savings|credit|td|kiwisaver),
               balance, source(akahu|csv|manual), akahu_id?
Transaction    id, account_id, date, amount, description, merchant, category_id,
               is_transfer, notes, split_parent_id?
Category       id, name, icon, colour, group(essentials|lifestyle|income|savings), budget_amount?
Rule           id, match_text, match_field, category_id
TermDeposit    id, bank, principal, rate, start_date, term_days, interest_freq(maturity|monthly|quarterly),
               compounding, rwt_rate, on_maturity(reinvest|payout), payout_account_id?, rollover_rate?
Goal           id, name, target_amount, target_date, priority, contribution_mode(fixed|surplus),
               contribution_amount
GoalLink       goal_id, account_id? | term_deposit_id?
Settings       pay_frequency, payday_anchor, rwt_rate, currency
```

---

## 6. Tech stack (proposed)

| Layer | Choice | Why |
|---|---|---|
| App | **Expo (React Native) + TypeScript** | One codebase for iOS and Android, fast to iterate |
| Navigation | Expo Router | File-based, simple |
| Storage | expo-sqlite + Drizzle ORM | Local-first: data stays on your phone |
| Charts | victory-native or react-native-gifted-charts | Line, bar and donut charts |
| Bank sync | Akahu API (personal app token) | Supports BNZ and ASB |
| Security | expo-local-authentication, expo-secure-store | Face ID/PIN, and the token stored in the keychain |
| Tests | Jest | Especially for the forecast engine |

---

## 7. Roadmap

1. **M1: Foundations.** Expo scaffold, DB schema, CSV import (BNZ and ASB), transactions list, categories
2. **M2: Cash flow and insights.** Dashboard, cash-flow chart, category breakdown, rules
3. **M3: Goals, TDs and forecast.** TD entry, goal entry, forecast engine with tests, goal detail chart
4. **M4: Akahu sync.** Automatic import and transfer detection
5. **M5: Extras.** Whichever ideas from §3 you choose

---

## 8. Decisions needed from you

1. Which **wireframe option** (A or B) for each screen in `wireframes.html`
2. **Akahu, CSV, or both**
3. **Budget period:** calendar month, or pay cycle (weekly / fortnightly / monthly)
4. Which **extra ideas** from §3 to include
5. Your **RWT rate** (it can be changed later)
