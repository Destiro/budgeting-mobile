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

**How transfers are found.** Two transactions are treated as one transfer when they have the same amount, opposite signs, sit in different accounts and fall within 3 days of each other (ASB to BNZ can take a day to arrive). Both sides are tagged and left out of income and spending. Credit card repayments work the same way: money out of an account, the same amount onto the card. Spending is counted on the day of the card purchase, not when the card is paid off. Categories you set yourself are never overwritten, and you can un-mark a match from the transaction screen.

**Example payday flow** (what the demo data follows): pay lands in ASB → part moves to the ASB rent account, which pays the rent → the rest moves to BNZ everyday → part moves to BNZ savings, and the rest pays off the BNZ credit card, which carries most of the day-to-day spending. Only the pay (in) and the real purchases, rent and bills (out) are counted. Everything in between is a transfer.

**Import every account that is part of the flow.** If only one bank is imported, the other half of a transfer is missing and money arriving from the other bank would look like income. Mark such a payment as a transfer once and it stays that way.

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

- ✅ **Done: UI and logic on demo data.** All chosen screens, forecast engine (with tests), TD interest after RWT, cash flow, budgets, categorisation rules, automatic transfer matching, and goal contributions taken from what you actually move into savings
- ✅ **Your own data.** Saved on the phone (expo-sqlite key-value store; localStorage in a browser), manual accounts, CSV import for BNZ and ASB with duplicate detection and transfer matching, getting-started checklist
1. **M1: Check against real exports.** Adjust the CSV reader to your actual BNZ/ASB files (the layouts are modelled on their documented formats, not on a real file)
2. **M2: Bills and subscriptions.** Detect recurring payments and show what's coming up before payday
3. **M3: Term deposit reminders.** Notify before a TD matures
4. **M4: Akahu sync.** Automatic import and transfer detection
5. **M5: Extras.** Whichever ideas from §3 you choose

---

## 8. Decisions

### Made
| Screen | Chosen option |
|---|---|
| Home dashboard | **1C**: net-worth overview |
| Cash flow | **2A**: monthly in/out bars |
| Spending | **3B**: budgets with progress bars |
| Transactions | **4**: list plus a categorise screen |
| Goal detail | **5A**: stacked forecast |
| Term deposits | **6**: list and add/edit form |
| Accounts | **7**: accounts and add-a-bank screen |
| Navigation | **8B**: four tabs plus a centre quick-add button; settings behind the cog on Home |

### Still open (current defaults in brackets)
1. **Akahu, CSV, or both** [both: CSV first, then Akahu]
2. **Budget period** [fortnightly, aligned to payday; changeable in Settings]
3. Which **extra ideas** from §3 to include [none yet]
4. Your **RWT rate** [30%; changeable in Settings]
