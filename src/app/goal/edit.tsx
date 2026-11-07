import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { colors } from '../../components/theme';
import { Button, Card, Chips, Field, Label, Screen, T, s } from '../../components/ui';
import { goalSummary } from '../../data/selectors';
import { newId, useStore } from '../../data/store';
import { monthlySavingsInflow } from '../../lib/analytics';
import { addMonths, monthLabel, parseISO, toISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import type { Goal } from '../../lib/types';

const EMOJI = ['🏠', '✈️', '🛟', '🚗', '💍', '🎓', '💻', '🎯'];
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && toISO(parseISO(v)) === v;

export default function EditGoal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useStore();
  const existing = state.goals.find((g) => g.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '🎯');
  const [target, setTarget] = useState(existing ? String(existing.target) : '');
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? toISO(addMonths(state.today, 12)));
  const [contribution, setContribution] = useState(existing ? String(existing.monthlyContribution) : '');
  const [auto, setAuto] = useState(existing?.autoContribution ?? false);
  const [accountIds, setAccountIds] = useState<string[]>(existing?.accountIds ?? []);
  const [tdIds, setTdIds] = useState<string[]>(
    existing ? state.termDeposits.filter((t) => t.goalId === existing.id).map((t) => t.id) : [],
  );

  const actual = Math.round(monthlySavingsInflow(state.transactions, accountIds, 3, state.today));
  const savings = state.accounts.filter((a) => a.type === 'savings' || a.type === 'everyday');
  const valid = name.trim() && Number(target) > 0 && isDate(targetDate);

  const draft: Goal = {
    id: existing?.id ?? newId('goal'),
    name: name.trim(),
    emoji,
    target: Number(target),
    targetDate,
    monthlyContribution: Number(contribution) || 0,
    autoContribution: auto && accountIds.length > 0,
    accountIds,
  };

  // Live preview using the TDs as they'd be linked after saving.
  const preview = valid
    ? goalSummary(
        {
          ...state,
          termDeposits: state.termDeposits.map((t) =>
            tdIds.includes(t.id) ? { ...t, goalId: draft.id } : t.goalId === draft.id ? { ...t, goalId: undefined } : t,
          ),
        },
        draft,
      )
    : null;

  const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  const save = () => {
    dispatch({ type: 'saveGoal', goal: draft });
    for (const t of state.termDeposits) {
      const linked = tdIds.includes(t.id);
      if (linked !== (t.goalId === draft.id)) {
        dispatch({ type: 'saveTermDeposit', td: { ...t, goalId: linked ? draft.id : undefined } });
      }
    }
    router.back();
  };

  return (
    <Screen>
      <Chips value={emoji} onChange={setEmoji} options={EMOJI.map((e) => ({ value: e, label: e }))} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="House deposit" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field label="Target ($)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Target date (YYYY-MM-DD)" value={targetDate} onChangeText={setTargetDate} autoCapitalize="none" style={{ flex: 1.3 }} />
      </View>
      <Field
        label={draft.autoContribution ? 'Monthly contribution ($, from your transfers)' : 'Monthly contribution ($)'}
        value={draft.autoContribution ? String(actual) : contribution}
        onChangeText={setContribution}
        keyboardType="decimal-pad"
        editable={!draft.autoContribution}
      />

      <Label>Accounts that count towards this goal</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {savings.map((a) => (
          <Chips
            key={a.id}
            value={accountIds.includes(a.id) ? a.id : null}
            onChange={() => setAccountIds(toggle(accountIds, a.id))}
            options={[{ value: a.id, label: `${a.bank} ${a.name}` }]}
          />
        ))}
      </View>
      {accountIds.length ? (
        <Card>
          <Pressable onPress={() => setAuto(!auto)} style={[s.between, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <T.Body>Use what I actually save</T.Body>
              <T.Mute>
                Average of the last 3 months of transfers into the accounts above: {formatMoney(actual, true)}/month
              </T.Mute>
            </View>
            <Switch value={auto} onValueChange={setAuto} trackColor={{ true: colors.accent }} />
          </Pressable>
        </Card>
      ) : null}
      {state.termDeposits.length ? (
        <>
          <Label>Term deposits that count towards this goal</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {state.termDeposits.map((t) => (
              <Chips
                key={t.id}
                value={tdIds.includes(t.id) ? t.id : null}
                onChange={() => setTdIds(toggle(tdIds, t.id))}
                options={[{ value: t.id, label: `${t.bank} ${formatMoney(t.principal, true)} @ ${(t.rate * 100).toFixed(2)}%` }]}
              />
            ))}
          </View>
        </>
      ) : null}

      {preview ? (
        <Card>
          <T.Body>
            {preview.status === 'done'
              ? 'Already reached 🎉'
              : preview.forecast.reachedDate
                ? `Forecast: reached ${monthLabel(preview.forecast.reachedDate, true)}`
                : 'Not reached within 10 years at this rate'}
          </T.Body>
          {preview.required !== null ? (
            <T.Mute>
              Needs {formatMoney(preview.required, true)}/month to hit {monthLabel(parseISO(targetDate), true)}
            </T.Mute>
          ) : null}
        </Card>
      ) : null}

      <Button title="Save goal" onPress={save} disabled={!valid} />
      {existing ? (
        <Button
          ghost
          title="Delete goal"
          onPress={() => {
            dispatch({ type: 'deleteGoal', id: existing.id });
            router.dismissTo('/goals');
          }}
        />
      ) : null}
    </Screen>
  );
}
