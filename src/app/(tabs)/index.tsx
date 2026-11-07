import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { LineChart } from '../../components/charts';
import { colors } from '../../components/theme';
import { Badge, Button, Card, ProgressBar, Row, Screen, T, s } from '../../components/ui';
import { goalSummary } from '../../data/selectors';
import { useStore } from '../../data/store';
import { netWorth, netWorthHistory } from '../../lib/analytics';
import { formatMoney, formatSigned } from '../../lib/money';

/** Wireframe option 1C: net-worth overview. */
export default function Home() {
  const { state } = useStore();
  const history = netWorthHistory(state.accounts, state.termDeposits, state.transactions, 7, state.today);
  const now = netWorth(state.accounts, state.termDeposits);
  const change = now - history[history.length - 2].value;
  const tdTotal = state.termDeposits.reduce((sum, t) => sum + t.principal, 0);

  const byType = (types: string[]) => state.accounts.filter((a) => types.includes(a.type));
  const groups = [
    { label: 'Everyday', items: byType(['everyday']) },
    { label: 'Savings', items: byType(['savings']) },
    { label: 'Credit cards', items: byType(['credit']) },
    { label: 'KiwiSaver', items: byType(['kiwisaver']) },
  ];

  return (
    <Screen header={false}>
      <View style={s.between}>
        <T.Title>Overview</T.Title>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </Pressable>
      </View>

      {state.mode === 'demo' ? (
        <Card>
          <T.H>You’re looking at demo data</T.H>
          <T.Mute>Everything here is made up. When you’re ready, clear it and add your own accounts.</T.Mute>
          <Button title="Use my own data" onPress={() => router.push('/start')} />
        </Card>
      ) : (
        <GettingStarted />
      )}

      <View>
        <T.Mute>Net worth</T.Mute>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <T.Big>{formatMoney(now, true)}</T.Big>
          <Text style={[s.mute, change >= 0 ? s.pos : s.neg]}>
            {change >= 0 ? '▲' : '▼'} {formatSigned(change, true).slice(1)} this month
          </Text>
        </View>
      </View>
      <LineChart values={history.map((h) => h.value)} />

      <Card onPress={() => router.push('/accounts')}>
        <View style={s.between}>
          <T.H>Accounts</T.H>
          <T.Mute>See all ›</T.Mute>
        </View>
        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <Row
              key={g.label}
              left={g.label}
              sub={g.items.length > 2 ? `${g.items.length} accounts` : g.items.map((a) => (a.bank === 'Other' ? a.name : `${a.bank} ${a.name}`)).filter((t) => t !== g.label).join(' · ')}
              right={formatMoney(g.items.reduce((sum, a) => sum + a.balance, 0), true)}
              rightStyle={g.label === 'Credit cards' ? s.neg : undefined}
            />
          ))}
        <Row left="Term deposits" sub={`${state.termDeposits.length} active`} right={formatMoney(tdTotal, true)} last />
      </Card>

      <Card onPress={() => router.push('/goals')}>
        <View style={s.between}>
          <T.H>Goals</T.H>
          <T.Mute>{state.goals.length} active</T.Mute>
        </View>
        {state.goals.map((g) => {
          const sum = goalSummary(state, g);
          return (
            <View key={g.id} style={{ gap: 4, paddingVertical: 4 }}>
              <View style={s.between}>
                <T.Body>
                  {g.emoji} {g.name}
                </T.Body>
                <Badge
                  text={sum.status === 'behind' ? 'Behind' : sum.status === 'done' ? 'Done' : 'On track'}
                  tone={sum.status === 'behind' ? 'warn' : 'good'}
                />
              </View>
              <ProgressBar value={sum.progress} color={sum.status === 'behind' ? colors.warn : colors.accent} />
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

/** Checklist shown after leaving the demo, until every step is done or it's dismissed. */
function GettingStarted() {
  const { state, dispatch } = useStore();
  if (state.onboardingDismissed) return null;
  const linked = state.goals.some(
    (g) => g.accountIds.length > 0 && state.termDeposits.some((t) => t.goalId === g.id),
  );
  const steps = [
    { done: state.accounts.length > 0, label: 'Add your accounts', sub: 'ASB pay and rent, BNZ everyday, savings and credit card', go: () => router.push('/account/edit') },
    { done: state.transactions.length > 0, label: 'Import transactions', sub: 'A CSV from internet banking for each account', go: () => router.push('/import') },
    { done: state.termDeposits.length > 0, label: 'Add your term deposit', sub: 'Rate, term and maturity', go: () => router.push('/td/edit') },
    {
      done: linked,
      label: 'Set up your goal',
      sub: 'Count your savings account and term deposit towards it',
      go: () => (state.goals[0] ? router.push({ pathname: '/goal/edit', params: { id: state.goals[0].id } }) : router.push('/goal/edit')),
    },
  ];
  const remaining = steps.filter((x) => !x.done).length;
  if (remaining === 0) return null;
  return (
    <Card>
      <View style={s.between}>
        <T.H>Getting started</T.H>
        <T.Mute>
          {steps.length - remaining} of {steps.length} done
        </T.Mute>
      </View>
      {steps.map((x, i) => (
        <Row
          key={x.label}
          wrap
          icon={x.done ? '✅' : String(i + 1)}
          left={x.label}
          sub={x.sub}
          right={x.done ? undefined : '›'}
          onPress={x.done ? undefined : x.go}
          last={i === steps.length - 1}
        />
      ))}
      <Pressable onPress={() => dispatch({ type: 'dismissOnboarding' })} hitSlop={8}>
        <T.Mute style={{ textAlign: 'right' }}>Hide</T.Mute>
      </Pressable>
    </Card>
  );
}
