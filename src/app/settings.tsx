import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Button, Card, Chips, Field, Label, Screen, T, s } from '../components/ui';
import { useStore } from '../data/store';
import { parseISO, toISO } from '../lib/dates';
import type { BudgetPeriod } from '../lib/types';

const RWT = ['0.105', '0.175', '0.3', '0.33', '0.39'] as const;

export default function SettingsScreen() {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const [anchor, setAnchor] = useState(settings.paydayAnchor);
  const [confirmErase, setConfirmErase] = useState(false);
  const where = Platform.OS === 'web' ? 'in this browser' : 'on this phone';

  return (
    <Screen>
      <Card>
        <T.H>Resident withholding tax (RWT)</T.H>
        <T.Mute>Tax taken off interest by the bank. It’s applied to all interest in forecasts and term deposits.</T.Mute>
        <Chips
          value={RWT.find((r) => Number(r) === settings.rwt) ?? null}
          onChange={(r) => dispatch({ type: 'updateSettings', settings: { rwt: Number(r) } })}
          options={RWT.map((r) => ({ value: r, label: `${+(Number(r) * 100).toFixed(1)}%` }))}
        />
      </Card>
      <Card>
        <T.H>Budget period</T.H>
        <Chips<BudgetPeriod>
          value={settings.budgetPeriod}
          onChange={(p) => dispatch({ type: 'updateSettings', settings: { budgetPeriod: p } })}
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'fortnightly', label: 'Fortnightly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
        {settings.budgetPeriod !== 'monthly' ? (
          <>
            <Label>Any recent payday, used to line up budget periods with your pay</Label>
            <Field
              label="Payday (YYYY-MM-DD)"
              value={anchor}
              onChangeText={(v) => {
                setAnchor(v);
                if (/^\d{4}-\d{2}-\d{2}$/.test(v) && toISO(parseISO(v)) === v) {
                  dispatch({ type: 'updateSettings', settings: { paydayAnchor: v } });
                }
              }}
              autoCapitalize="none"
            />
          </>
        ) : null}
      </Card>
      <Card>
        <T.H>Your data</T.H>
        {state.mode === 'demo' ? (
          <>
            <T.Mute>You’re looking at demo data. It isn’t saved.</T.Mute>
            <Button title="Use my own data" onPress={() => router.push('/start')} />
          </>
        ) : (
          <>
            <T.Mute>
              {state.accounts.length} accounts and {state.transactions.length} transactions, saved {where} only.
            </T.Mute>
            <Button
              ghost
              title={confirmErase ? 'Tap again to erase everything' : 'Erase my data and go back to the demo'}
              onPress={() => {
                if (!confirmErase) return setConfirmErase(true);
                dispatch({ type: 'resetToDemo' });
                router.dismissTo('/');
              }}
            />
            {confirmErase ? <T.Mute style={s.neg}>This deletes your accounts, transactions, goals and term deposits. It can’t be undone.</T.Mute> : null}
          </>
        )}
      </Card>
    </Screen>
  );
}
