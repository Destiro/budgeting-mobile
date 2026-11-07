import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors } from '../../components/theme';
import { Badge, Button, Card, ProgressBar, Screen, T, s } from '../../components/ui';
import { goalSummary } from '../../data/selectors';
import { useStore } from '../../data/store';
import { monthLabel, parseISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';

export default function Goals() {
  const { state } = useStore();
  return (
    <Screen header={false}>
      <View style={s.between}>
        <T.Title>Goals</T.Title>
        <Pressable onPress={() => router.push('/goal/edit')} accessibilityLabel="New goal" hitSlop={10}>
          <T.Title>＋</T.Title>
        </Pressable>
      </View>
      {state.goals.map((g) => {
        const sum = goalSummary(state, g);
        const behind = sum.status === 'behind';
        return (
          <Card key={g.id} onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.id } })}>
            <View style={s.between}>
              <T.H>
                {g.emoji} {g.name}
              </T.H>
              <Badge text={behind ? 'Behind' : sum.status === 'done' ? 'Done ✓' : 'On track'} tone={behind ? 'warn' : 'good'} />
            </View>
            <ProgressBar value={sum.progress} color={behind ? colors.warn : colors.accent} />
            <T.Mute>
              {formatMoney(sum.current, true)} of {formatMoney(g.target, true)} · target {monthLabel(parseISO(g.targetDate), true)}
              {sum.forecast.reachedDate && sum.status !== 'done' ? ` · est. ${monthLabel(sum.forecast.reachedDate, true)}` : ''}
            </T.Mute>
            {behind && sum.required !== null ? (
              <T.Mute style={s.neg}>
                Save {formatMoney(sum.required, true)}/month (+{formatMoney(sum.required - g.monthlyContribution, true)}) to hit the target date
              </T.Mute>
            ) : null}
          </Card>
        );
      })}
      {state.goals.length === 0 ? (
        <Card>
          <T.Body>No goals yet. Add one to start forecasting.</T.Body>
          <Button title="Add a goal" onPress={() => router.push('/goal/edit')} />
        </Card>
      ) : null}
    </Screen>
  );
}
