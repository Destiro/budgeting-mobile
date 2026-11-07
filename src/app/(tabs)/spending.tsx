import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { InOutBars, Legend } from '../../components/charts';
import { colors } from '../../components/theme';
import { Card, Chips, Field, ProgressBar, Row, Screen, Segmented, T, s } from '../../components/ui';
import { useStore } from '../../data/store';
import { currentPeriod, monthlyCashFlow, spendByCategory, spendByGroup } from '../../lib/analytics';
import { addDays, addMonths, daysBetween, monthLabel, parseISO, shortDate } from '../../lib/dates';
import { formatMoney, formatSigned } from '../../lib/money';

type Tab = 'cashflow' | 'budgets' | 'transactions';

export default function Spending() {
  const [tab, setTab] = useState<Tab>('cashflow');
  return (
    <Screen header={false}>
      <T.Title>Spending</T.Title>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'cashflow', label: 'Cash flow' },
          { value: 'budgets', label: 'Budgets' },
          { value: 'transactions', label: 'Transactions' },
        ]}
      />
      {tab === 'cashflow' ? <CashFlow /> : tab === 'budgets' ? <Budgets /> : <Transactions />}
    </Screen>
  );
}

/* ---------- Wireframe 2A: monthly in/out bars ---------- */

const GROUP_LABELS: Record<string, string> = {
  essentials: 'Essentials',
  lifestyle: 'Lifestyle',
  bills: 'Bills & subscriptions',
  uncategorised: 'Uncategorised',
};

function CashFlow() {
  const { state } = useStore();
  const [range, setRange] = useState<'6' | '12'>('6');
  const months = Number(range);
  const flows = useMemo(() => monthlyCashFlow(state.transactions, months, state.today), [state.transactions, months, state.today]);
  const [selected, setSelected] = useState(flows.length - 1);
  const sel = flows[Math.min(selected, flows.length - 1)];

  // Average over complete months only (the current month is partial).
  const complete = flows.slice(0, -1).filter((f) => f.in || f.out);
  const avgSurplus = complete.length ? complete.reduce((sum, f) => sum + f.in - f.out, 0) / complete.length : 0;
  const groups = spendByGroup(state.transactions, state.categories, { start: sel.month, end: addMonths(sel.month, 1) });

  return (
    <>
      <Chips
        value={range}
        onChange={(v) => {
          setRange(v);
          setSelected(Number(v) - 1);
        }}
        options={[
          { value: '6', label: '6 months' },
          { value: '12', label: '12 months' },
        ]}
      />
      <Card>
        <InOutBars
          data={flows.map((f) => ({ label: monthLabel(f.month), in: f.in, out: f.out }))}
          selected={selected}
          onSelect={setSelected}
        />
        <Legend
          items={[
            { color: colors.accent, label: 'In' },
            { color: colors.warn, label: 'Out' },
          ]}
        />
        <T.Mute>
          Average surplus{' '}
          <T.Mute style={[{ fontWeight: '700' }, avgSurplus >= 0 ? s.pos : s.neg]}>{formatSigned(avgSurplus, true)}/month</T.Mute>
          {'  ·  '}tap a month for details
        </T.Mute>
      </Card>

      <Card>
        <T.H>{monthLabel(sel.month, true)}</T.H>
        <Row left="Income" right={formatSigned(sel.in)} rightStyle={s.pos} />
        {Object.entries(GROUP_LABELS)
          .filter(([k]) => groups[k])
          .map(([k, label]) => (
            <Row key={k} left={label} right={formatSigned(-groups[k])} rightStyle={k === 'uncategorised' ? s.neg : undefined} />
          ))}
        <Row
          left="Net"
          right={formatSigned(sel.in - sel.out)}
          rightStyle={[{ fontWeight: '700' }, sel.in - sel.out >= 0 ? s.pos : s.neg]}
          last
        />
        <T.Mute>Transfers between your own accounts aren't counted.</T.Mute>
      </Card>
    </>
  );
}

/* ---------- Wireframe 3B: budgets with progress bars ---------- */

function Budgets() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const period = currentPeriod(state.settings, state.today);
  const spent = spendByCategory(state.transactions, period);
  const daysLeft = daysBetween(state.today, period.end);
  const budgeted = new Set(state.budgets.map((b) => b.categoryId));
  const unbudgeted = [...spent.entries()]
    .filter(([id]) => id && !budgeted.has(id))
    .reduce((sum, [, v]) => sum + v, 0);
  const unbudgetedCats = state.categories.filter(
    (c) => !budgeted.has(c.id) && (c.group === 'lifestyle' || c.group === 'essentials'),
  );

  const periodName = { monthly: 'Month', fortnightly: 'Fortnight', weekly: 'Week' }[state.settings.budgetPeriod];

  const save = (categoryId: string) => {
    dispatch({ type: 'setBudget', categoryId, amount: Number(draft) || 0 });
    setEditing(null);
  };

  return (
    <>
      <T.Mute>
        {periodName} {shortDate(period.start)} – {shortDate(addDays(period.end, -1))} · {daysLeft} day{daysLeft === 1 ? '' : 's'} left ·
        change in Settings
      </T.Mute>
      {state.budgets.map((b) => {
        const cat = state.categories.find((c) => c.id === b.categoryId);
        const used = spent.get(b.categoryId) ?? 0;
        const over = used > b.amount;
        return (
          <Card
            key={b.categoryId}
            onPress={() => {
              setEditing(b.categoryId);
              setDraft(String(b.amount));
            }}
          >
            <View style={s.between}>
              <T.Body>
                {cat?.emoji} {cat?.name}
              </T.Body>
              <T.Body style={over ? s.neg : undefined}>
                {formatMoney(used, true)} / {formatMoney(b.amount, true)}
              </T.Body>
            </View>
            <ProgressBar value={used / b.amount} color={over ? colors.warn : used / b.amount > 0.8 ? '#c9a227' : colors.accent} />
            {editing === b.categoryId ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <Field
                  label={`Budget per ${periodName.toLowerCase()} ($, 0 removes)`}
                  value={draft}
                  onChangeText={setDraft}
                  keyboardType="decimal-pad"
                  autoFocus
                  onSubmitEditing={() => save(b.categoryId)}
                  style={{ flex: 1, backgroundColor: colors.bg }}
                />
                <Pressable onPress={() => save(b.categoryId)} style={{ padding: 10 }}>
                  <T.H>Save</T.H>
                </Pressable>
              </View>
            ) : null}
          </Card>
        );
      })}
      <Card>
        <Row left="Unbudgeted spending" right={formatMoney(unbudgeted, true)} />
        <Row
          left="Uncategorised"
          right={formatMoney(spent.get(null) ?? 0, true)}
          rightStyle={spent.get(null) ? s.neg : undefined}
          last
        />
      </Card>
      {unbudgetedCats.length ? (
        <Card>
          <T.H>Add a budget</T.H>
          <Chips
            value={null}
            onChange={(id) => {
              dispatch({ type: 'setBudget', categoryId: id, amount: 100 });
              setEditing(id);
              setDraft('100');
            }}
            options={unbudgetedCats.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))}
          />
        </Card>
      ) : null}
    </>
  );
}

/* ---------- Wireframe 4: transactions ---------- */

type Filter = 'all' | 'ASB' | 'BNZ' | 'uncategorised';
const PAGE = 60;

function Transactions() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const bankOf = useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts]);
  const catOf = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);
  const txById = useMemo(() => new Map(state.transactions.map((t) => [t.id, t])), [state.transactions]);
  const uncategorised = state.transactions.filter((t) => !t.categoryId).length;

  const rows = state.transactions.filter((t) => {
    if (filter === 'uncategorised' && t.categoryId) return false;
    if ((filter === 'ASB' || filter === 'BNZ') && bankOf.get(t.accountId)?.bank !== filter) return false;
    if (q) {
      const needle = q.toLowerCase();
      return t.description.toLowerCase().includes(needle) || Math.abs(t.amount).toFixed(2).includes(needle);
    }
    return true;
  });

  const shown = rows.slice(0, limit);
  const byDate: { date: string; items: typeof rows }[] = [];
  for (const t of shown) {
    const last = byDate[byDate.length - 1];
    if (last?.date === t.date) last.items.push(t);
    else byDate.push({ date: t.date, items: [t] });
  }

  const dayLabel = (iso: string) => {
    const diff = daysBetween(parseISO(iso), state.today);
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : shortDate(parseISO(iso));
  };

  return (
    <>
      <Field label="Search" placeholder="Merchant or amount" value={q} onChangeText={setQ} autoCorrect={false} />
      <Chips
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setLimit(PAGE);
        }}
        options={[
          { value: 'all', label: 'All' },
          { value: 'ASB', label: 'ASB' },
          { value: 'BNZ', label: 'BNZ' },
          { value: 'uncategorised', label: `Uncategorised (${uncategorised})` },
        ]}
      />
      {byDate.map((g) => (
        <View key={g.date} style={{ gap: 4 }}>
          <T.Mute>{dayLabel(g.date)}</T.Mute>
          <Card style={{ paddingVertical: 2 }}>
            {g.items.map((t, i) => {
              const cat = t.categoryId ? catOf.get(t.categoryId) : undefined;
              const acct = bankOf.get(t.accountId);
              const other = t.transferPairId ? bankOf.get(txById.get(t.transferPairId)?.accountId ?? '') : undefined;
              // "Pay account → Rent account", with the bank named only when it changes.
              const from = t.amount < 0 ? acct : other;
              const to = t.amount < 0 ? other : acct;
              const name = (a: typeof acct, withBank: boolean) => (withBank ? `${a?.bank} ${a?.name}` : a?.name);
              const label =
                cat?.id === 'transfer'
                  ? from && to
                    ? `${name(from, from.bank !== to.bank)} → ${name(to, from.bank !== to.bank)}`
                    : 'Transfer'
                  : `${cat?.name ?? 'Uncategorised'} · ${acct?.bank} ${acct?.name}`;
              return (
                <Row
                  key={t.id}
                  icon={cat?.emoji ?? '❔'}
                  left={t.description}
                  sub={label}
                  right={formatSigned(t.amount)}
                  rightStyle={cat?.id === 'transfer' ? { color: colors.mute } : t.amount > 0 ? s.pos : undefined}
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id } })}
                  last={i === g.items.length - 1}
                />
              );
            })}
          </Card>
        </View>
      ))}
      {rows.length === 0 ? <T.Mute>No transactions match.</T.Mute> : null}
      {rows.length > limit ? (
        <Pressable onPress={() => setLimit(limit + PAGE)} style={{ alignItems: 'center', padding: 12 }}>
          <T.H>Show more ({rows.length - limit})</T.H>
        </Pressable>
      ) : null}
    </>
  );
}
