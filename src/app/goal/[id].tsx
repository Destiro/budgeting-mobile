import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Legend, StackedArea } from '../../components/charts';
import { colors } from '../../components/theme';
import { Badge, Card, Row, Screen, T, s } from '../../components/ui';
import { goalSummary } from '../../data/selectors';
import { useStore } from '../../data/store';
import { daysBetween, monthLabel, parseISO } from '../../lib/dates';
import { formatMoney, formatPercent, formatSigned } from '../../lib/money';
import { maturityDate } from '../../lib/termDeposit';

/** Wireframe option 5A: goal detail with a stacked forecast. */
export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const goal = state.goals.find((g) => g.id === id);
  if (!goal) return null;

  const { forecast, current, status, required, input } = goalSummary(state, goal);
  const targetDate = parseISO(goal.targetDate);
  const { points, reachedDate } = forecast;

  const monthsEarly = reachedDate ? Math.round(daysBetween(reachedDate, targetDate) / 30.44) : 0;
  const headline =
    status === 'done'
      ? 'Goal reached 🎉'
      : reachedDate
        ? `Reach it ${monthLabel(reachedDate, true)}`
        : 'Not reached within 10 years';
  const sub =
    status === 'done' || !reachedDate
      ? ''
      : monthsEarly > 0
        ? `${monthsEarly} month${monthsEarly === 1 ? '' : 's'} early`
        : monthsEarly < 0
          ? `${-monthsEarly} month${monthsEarly === -1 ? '' : 's'} late`
          : 'right on time';

  const linkedAccounts = state.accounts.filter((a) => goal.accountIds.includes(a.id));
  const linkedTDs = input.termDeposits;

  // Mark TD maturities on the chart.
  const indexOf = (d: Date) => points.findIndex((p) => p.date >= d);
  const markers = linkedTDs
    .map((td) => ({ index: indexOf(maturityDate(td)), label: `${td.bank} TD matures` }))
    .filter((m) => m.index > 0);
  const step = Math.max(1, Math.ceil(points.length / 5));
  const labels = points
    .map((p, i) => ({ index: i, text: monthLabel(p.date) + (p.date.getMonth() === 0 || i === 0 ? ` ${String(p.date.getFullYear()).slice(2)}` : '') }))
    // Every `step` months plus the last point, dropping one that would crowd the last label.
    .filter((_, i) => i === points.length - 1 || (i % step === 0 && points.length - 1 - i >= step / 2));

  const interestByTarget = (points.find((p) => p.date >= targetDate) ?? points[points.length - 1]).interest;
  const upcoming = forecast.events.filter((e) => e.kind !== 'td-interest' || e.amount! > 5).slice(0, 8);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: `${goal.emoji} ${goal.name}`,
          headerRight: () => (
            <Pressable onPress={() => router.push({ pathname: '/goal/edit', params: { id: goal.id } })} hitSlop={10}>
              <T.Body>Edit</T.Body>
            </Pressable>
          ),
        }}
      />
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <T.Big>{formatMoney(current, true)}</T.Big>
          <T.Mute>/ {formatMoney(goal.target, true)}</T.Mute>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <T.H style={status === 'behind' ? s.neg : s.pos}>{headline}</T.H>
          {sub ? <Badge text={sub} tone={monthsEarly >= 0 ? 'good' : 'warn'} /> : null}
        </View>
        {status === 'behind' && required !== null ? (
          <T.Mute style={{ marginTop: 4 }}>
            To hit {monthLabel(targetDate, true)}, save {formatMoney(required, true)}/month instead of {formatMoney(input.monthlyContribution, true)}.
          </T.Mute>
        ) : null}
      </View>

      <Card>
        <StackedArea
          target={goal.target}
          markers={markers}
          labels={labels}
          series={[
            { values: points.map((p) => p.startingBalance), color: colors.saved },
            { values: points.map((p) => p.contributions), color: colors.accent, opacity: 0.55 },
            { values: points.map((p) => Math.max(0, p.interest)), color: colors.ink, opacity: 0.85 },
          ]}
        />
        <Legend
          items={[
            { color: colors.saved, label: 'Saved now' },
            { color: '#8fb3a8', label: 'Contributions' },
            { color: colors.ink, label: 'Interest (after RWT)' },
          ]}
        />
      </Card>

      <Card>
        <T.H>What's counted</T.H>
        {linkedAccounts.map((a) => (
          <Row
            key={a.id}
            left={`${a.bank} ${a.name}`}
            sub={a.interestRate ? `${formatPercent(a.interestRate)} p.a.` : undefined}
            right={formatMoney(a.balance)}
          />
        ))}
        {linkedTDs.map((td) => (
          <Row
            key={td.id}
            left={`${td.bank} TD ${td.termMonths}m`}
            sub={`${formatPercent(td.rate)} · matures ${monthLabel(maturityDate(td), true)} · ${td.onMaturity === 'reinvest' ? 'reinvest' : 'pay out'}`}
            right={formatMoney(td.principal)}
            onPress={() => router.push({ pathname: '/td/edit', params: { id: td.id } })}
          />
        ))}
        <Row
          left="Contribution"
          sub={goal.autoContribution ? 'avg of your last 3 months of transfers' : undefined}
          right={`${formatMoney(input.monthlyContribution, true)}/mo`}
        />
        <Row
          left={`Interest by ${monthLabel(targetDate, true)}`}
          sub={`after ${Math.round(state.settings.rwt * 100)}% RWT`}
          right={formatSigned(interestByTarget)}
          rightStyle={s.pos}
          last
        />
        {linkedAccounts.length + linkedTDs.length === 0 ? (
          <T.Mute>Link a savings account or term deposit via Edit to include its balance and interest.</T.Mute>
        ) : null}
      </Card>

      {upcoming.length ? (
        <Card>
          <T.H>Timeline</T.H>
          {upcoming.map((e, i) => (
            <Row
              key={i}
              left={monthLabel(e.date, true)}
              right={
                e.kind === 'goal-reached'
                  ? '🎯 Goal reached'
                  : e.kind === 'target-date'
                    ? 'Target date'
                    : `${e.label.replace(/ (matures|interest)$/, '')} ${e.kind === 'td-matured' ? 'matures' : 'interest'} ${formatSigned(e.amount ?? 0, true)}`
              }
              rightStyle={e.kind === 'goal-reached' ? s.pos : e.kind === 'target-date' ? { color: colors.mute } : undefined}
              last={i === upcoming.length - 1}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
