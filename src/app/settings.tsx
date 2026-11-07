import { Card, Chips, Field, Label, Screen, T } from '../components/ui';
import { useStore } from '../data/store';
import { parseISO, toISO } from '../lib/dates';
import type { BudgetPeriod } from '../lib/types';
import { useState } from 'react';

const RWT = ['0.105', '0.175', '0.3', '0.33', '0.39'] as const;

export default function SettingsScreen() {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const [anchor, setAnchor] = useState(settings.paydayAnchor);

  return (
    <Screen>
      <Card>
        <T.H>Resident withholding tax (RWT)</T.H>
        <T.Mute>Tax taken off interest by the bank. It's applied to all interest in forecasts and term deposits.</T.Mute>
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
      <T.Mute>Data is demo data held in memory for now. Saving to the phone and bank sync are next.</T.Mute>
    </Screen>
  );
}
