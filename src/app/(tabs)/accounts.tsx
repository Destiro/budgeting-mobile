import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors } from '../../components/theme';
import { Button, Card, ProgressBar, Row, Screen, T, s } from '../../components/ui';
import { useStore } from '../../data/store';
import { daysBetween, shortDate } from '../../lib/dates';
import type { Bank } from '../../lib/types';
import { formatMoney, formatPercent, formatSigned } from '../../lib/money';
import { maturityDate, termProgress, totalTermInterest } from '../../lib/termDeposit';

const BANKS: Bank[] = ['BNZ', 'ASB', 'Other'];

/** Wireframes 6 (term deposit list) and 7 (accounts). */
export default function Accounts() {
  const { state } = useStore();
  const { rwt } = state.settings;
  const tds = [...state.termDeposits].sort((a, b) => +maturityDate(a) - +maturityDate(b));
  const tdTotal = tds.reduce((sum, t) => sum + t.principal, 0);
  const tdInterest = tds.reduce((sum, t) => sum + totalTermInterest(t, rwt).net, 0);

  return (
    <Screen header={false}>
      <View style={s.between}>
        <T.Title>Accounts</T.Title>
        <Pressable onPress={() => router.push('/connect')} accessibilityLabel="Add accounts" hitSlop={10}>
          <T.Title>＋</T.Title>
        </Pressable>
      </View>

      {BANKS.map((bank) => {
        const accts = state.accounts.filter((a) => a.bank === bank);
        if (!accts.length) return null;
        return (
          <View key={bank} style={{ gap: 4 }}>
            <T.Mute>{bank === 'Other' ? 'Other' : state.mode === 'demo' ? `${bank} · demo data` : bank}</T.Mute>
            <Card style={{ paddingVertical: 2 }}>
              {accts.map((a, i) => (
                <Row
                  key={a.id}
                  left={a.name}
                  sub={a.interestRate ? `${formatPercent(a.interestRate)} p.a.` : a.type === 'credit' ? 'Credit card' : undefined}
                  right={formatMoney(a.balance)}
                  rightStyle={a.balance < 0 ? s.neg : undefined}
                  last={i === accts.length - 1}
                  onPress={() => router.push({ pathname: '/account/edit', params: { id: a.id } })}
                />
              ))}
            </Card>
          </View>
        );
      })}

      {state.accounts.length === 0 ? (
        <Card>
          <T.H>No accounts yet</T.H>
          <T.Mute>Add each account your money moves through, then import its transactions from a CSV.</T.Mute>
          <Button title="Add an account" onPress={() => router.push('/account/edit')} />
        </Card>
      ) : (
        <Button ghost title="Import a CSV" onPress={() => router.push('/import')} />
      )}

      <View style={[s.between, { marginTop: 8 }]}>
        <T.H>Term deposits</T.H>
        <Pressable onPress={() => router.push('/td/edit')} hitSlop={10}>
          <T.Body style={{ fontWeight: '600' }}>＋ Add</T.Body>
        </Pressable>
      </View>
      <Card>
        <T.Mute>Total invested</T.Mute>
        <T.Big>{formatMoney(tdTotal, true)}</T.Big>
        <T.Mute>
          Interest over current terms, after {Math.round(rwt * 100)}% RWT:{' '}
          <T.Mute style={[s.pos, { fontWeight: '700' }]}>{formatSigned(tdInterest)}</T.Mute>
        </T.Mute>
      </Card>
      {tds.map((td) => {
        const mat = maturityDate(td);
        const days = daysBetween(state.today, mat);
        const soon = days >= 0 && days <= 30;
        const interest = totalTermInterest(td, rwt).net;
        const goal = state.goals.find((g) => g.id === td.goalId);
        return (
          <Card key={td.id} onPress={() => router.push({ pathname: '/td/edit', params: { id: td.id } })}>
            <View style={s.between}>
              <T.H>
                {td.bank} · {td.termMonths} months
              </T.H>
              <T.H>{formatPercent(td.rate)}</T.H>
            </View>
            <T.Mute>
              {formatMoney(td.principal, true)} · {days >= 0 ? `matures ${shortDate(mat)} (${days} days)` : `matured ${shortDate(mat)}`}
            </T.Mute>
            <ProgressBar value={termProgress(td, state.today)} color={soon ? colors.warn : colors.accent} />
            <T.Mute>
              {td.interestFrequency === 'maturity' ? 'At maturity' : `Paid ${td.interestFrequency}`}: {formatSigned(interest)} →{' '}
              {td.onMaturity === 'reinvest' ? 'reinvest' : 'pay out'}
              {goal ? ` · ${goal.emoji} ${goal.name}` : ''}
            </T.Mute>
            {soon ? <T.Mute style={s.neg}>⏰ Maturing soon: check rates and decide whether to reinvest</T.Mute> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
