# budgeting-mobile

A personal budgeting app for tracking spending across **BNZ** and **ASB** accounts, forecasting savings towards goals, and factoring **term deposits (with interest, after RWT)** into those forecasts.

Built with Expo (React Native + TypeScript), so it runs on iOS, Android and the web.

## Run it

```bash
npm install
npx expo start        # then scan the QR code with the Expo Go app on your phone
npm run web           # or open it in a browser
```

### Preview in a phone browser

`npm run preview:build` writes a single self-contained `dist-preview/kowhai-budget.html` that runs the whole app (web version) from any static host.

```bash
npm test              # forecast + analytics unit tests
npm run typecheck
```

![Screens](docs/screenshots.png)

## What's in it

| Screen | Wireframe | What it does |
|---|---|---|
| Home | 1C | Net worth with a 6-month trend, accounts grouped by type, goal progress |
| Spending › Cash flow | 2A | Money in vs. out per month (6 or 12 months); tap a month for its breakdown |
| Spending › Budgets | 3B | Per-category budgets for the current week, fortnight or month, aligned to payday |
| Spending › Transactions | 4 | Search, filter by bank or uncategorised; tap to categorise and create a rule |
| Goals / goal detail | 5A | Forecast chart split into saved, contributions and interest; on-track date; required monthly saving |
| Accounts | 6, 7 | Accounts by bank; term deposits with maturity countdown and after-tax interest |
| ＋ (centre tab) | 8B | Quick add: transaction, term deposit or goal |

The app opens on **demo data**. Tap **Use my own data** on Home to clear it and add your own accounts; from then on everything is saved on the device (expo-sqlite key-value store on the phone, localStorage in a browser).

### Importing transactions

1. In ASB or BNZ internet banking, export the account's transactions as CSV.
2. In the app: Accounts › Import a CSV, pick the account, choose the file.
3. Check the preview (dates, amounts, how many are new) and import. Re-importing an overlapping date range skips what's already there.

Rules categorise common NZ merchants automatically, and transfers between your own accounts (including credit card repayments) are paired and left out of spending once both sides are imported.

## Layout

```
src/
  app/          screens (Expo Router: every file is a route)
  components/   UI kit and SVG charts
  data/         state store, demo data, selectors
  lib/          pure logic: forecast engine, term deposit maths, analytics (unit tested)
docs/
  DESIGN.md       features, forecasting maths, data model, roadmap
  wireframes.html the original wireframe options
```
