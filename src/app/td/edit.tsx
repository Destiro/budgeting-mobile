import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chips, Field, Label, Screen, T, s } from '../../components/ui';
import { newId, todayISO, useStore } from '../../data/store';
import { parseISO, shortDate, toISO } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { maturityDate, totalTermInterest } from '../../lib/termDeposit';
import type { Bank, InterestFrequency, TermDeposit } from '../../lib/types';

const TERMS = ['3', '6', '9', '12', '18', '24', '36'] as const;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && toISO(parseISO(v)) === v;

/** Wireframe 6: add/edit term deposit. */
export default function EditTermDeposit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useStore();
  const existing = state.termDeposits.find((t) => t.id === id);

  const [bank, setBank] = useState<Bank>(existing?.bank ?? 'BNZ');
  const [principal, setPrincipal] = useState(existing ? String(existing.principal) : '');
  const [rate, setRate] = useState(existing ? String(+(existing.rate * 100).toFixed(3)) : '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayISO(state));
  const [term, setTerm] = useState(String(existing?.termMonths ?? 12));
  const [freq, setFreq] = useState<InterestFrequency>(existing?.interestFrequency ?? 'maturity');
  const [onMaturity, setOnMaturity] = useState<TermDeposit['onMaturity']>(existing?.onMaturity ?? 'reinvest');
  const [rollover, setRollover] = useState(existing?.rolloverRate ? String(+(existing.rolloverRate * 100).toFixed(3)) : '');
  const [goalId, setGoalId] = useState<string>(existing?.goalId ?? 'none');

  const p = Number(principal);
  const r = Number(rate) / 100;
  const months = Number(term);
  const valid = p > 0 && r > 0 && r < 0.25 && months > 0 && isDate(startDate);

  const draft: TermDeposit = {
    id: existing?.id ?? newId('td'),
    bank,
    principal: p,
    rate: r,
    startDate,
    termMonths: months,
    interestFrequency: freq,
    onMaturity,
    rolloverRate: rollover ? Number(rollover) / 100 : undefined,
    goalId: goalId === 'none' ? undefined : goalId,
  };
  const interest = valid ? totalTermInterest(draft, state.settings.rwt) : null;

  const save = () => {
    dispatch({ type: 'saveTermDeposit', td: draft });
    router.back();
  };

  return (
    <Screen>
      <Chips<Bank>
        value={bank}
        onChange={setBank}
        options={[
          { value: 'BNZ', label: 'BNZ' },
          { value: 'ASB', label: 'ASB' },
          { value: 'Other', label: 'Other' },
        ]}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field label="Amount ($)" value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" placeholder="10000" style={{ flex: 1 }} />
        <Field label="Rate (% p.a.)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="4.60" style={{ flex: 1 }} />
      </View>
      <Field
        label="Start date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Label>Term (months)</Label>
      <Chips value={term as (typeof TERMS)[number]} onChange={setTerm} options={TERMS.map((t) => ({ value: t, label: t }))} />
      <Label>Interest paid</Label>
      <Chips<InterestFrequency>
        value={freq}
        onChange={setFreq}
        options={[
          { value: 'maturity', label: 'At maturity' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'monthly', label: 'Monthly' },
        ]}
      />
      <Label>At maturity</Label>
      <Chips<TermDeposit['onMaturity']>
        value={onMaturity}
        onChange={setOnMaturity}
        options={[
          { value: 'reinvest', label: freq === 'maturity' ? 'Reinvest principal + interest' : 'Reinvest principal' },
          { value: 'payout', label: 'Pay out to savings' },
        ]}
      />
      {onMaturity === 'reinvest' ? (
        <Field
          label="Assumed rollover rate (% p.a., blank = same rate)"
          value={rollover}
          onChangeText={setRollover}
          keyboardType="decimal-pad"
        />
      ) : null}
      <Label>Count towards goal</Label>
      <Chips
        value={goalId}
        onChange={setGoalId}
        options={[{ value: 'none', label: 'None' }, ...state.goals.map((g) => ({ value: g.id, label: `${g.emoji} ${g.name}` }))]}
      />

      <Card>
        {interest ? (
          <>
            <T.Mute>Matures {shortDate(maturityDate(draft))}</T.Mute>
            <T.Body>
              Interest {formatMoney(interest.gross)} gross − {formatMoney(interest.tax)} RWT ={' '}
              <T.Body style={[s.pos, { fontWeight: '700' }]}>{formatMoney(interest.net)}</T.Body>
            </T.Body>
            <T.Mute>RWT rate {Math.round(state.settings.rwt * 100)}% (change in Settings)</T.Mute>
          </>
        ) : (
          <T.Mute>Enter an amount, rate and start date to see the interest.</T.Mute>
        )}
      </Card>
      <Button title="Save" onPress={save} disabled={!valid} />
      {existing ? (
        <Button
          ghost
          title="Delete term deposit"
          onPress={() => {
            dispatch({ type: 'deleteTermDeposit', id: existing.id });
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}
