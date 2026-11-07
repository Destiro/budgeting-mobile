import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chips, Field, Label, Screen, T, s } from '../../components/ui';
import { newId, useStore } from '../../data/store';
import type { Account, AccountType, Bank } from '../../lib/types';

const TYPES: { value: AccountType; label: string }[] = [
  { value: 'everyday', label: 'Everyday' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit card' },
  { value: 'kiwisaver', label: 'KiwiSaver' },
];

/** Add or edit one of your accounts. */
export default function EditAccount() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useStore();
  const existing = state.accounts.find((a) => a.id === id);

  const [bank, setBank] = useState<Bank>(existing?.bank ?? 'ASB');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'everyday');
  const [name, setName] = useState(existing?.name ?? '');
  const [balance, setBalance] = useState(existing ? String(Math.abs(existing.balance)) : '');
  const [rate, setRate] = useState(existing?.interestRate ? String(+(existing.interestRate * 100).toFixed(3)) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const txCount = existing ? state.transactions.filter((t) => t.accountId === existing.id).length : 0;
  const amount = Number(balance || 0);
  const valid = name.trim() !== '' && !Number.isNaN(amount);

  const save = (thenImport: boolean) => {
    const account: Account = {
      id: existing?.id ?? newId('acct'),
      bank,
      name: name.trim(),
      type,
      // Credit cards hold what you owe, so their balance is negative.
      balance: type === 'credit' ? -Math.abs(amount) : amount,
      interestRate: type === 'savings' && rate ? Number(rate) / 100 : undefined,
      source: existing?.source ?? 'manual',
    };
    dispatch({ type: 'saveAccount', account });
    if (thenImport) router.replace({ pathname: '/import', params: { accountId: account.id } });
    else router.back();
  };

  return (
    <Screen>
      <Label>Bank</Label>
      <Chips<Bank>
        value={bank}
        onChange={setBank}
        options={[
          { value: 'ASB', label: 'ASB' },
          { value: 'BNZ', label: 'BNZ' },
          { value: 'Other', label: 'Other' },
        ]}
      />
      <Label>Type</Label>
      <Chips value={type} onChange={setType} options={TYPES} />
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder={type === 'credit' ? 'Credit Card' : type === 'savings' ? 'Rapid Save' : 'Pay account'}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field
          label={type === 'credit' ? 'Amount owing ($)' : 'Balance now ($)'}
          value={balance}
          onChangeText={setBalance}
          keyboardType="numbers-and-punctuation"
          style={{ flex: 1 }}
        />
        {type === 'savings' ? (
          <Field label="Interest (% p.a.)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" style={{ flex: 1 }} />
        ) : null}
      </View>
      {type === 'savings' ? (
        <T.Mute>The interest rate is used to forecast goals this account counts towards.</T.Mute>
      ) : null}

      {existing ? (
        <>
          <Button title="Save" onPress={() => save(false)} disabled={!valid} />
          <Button ghost title="Import a CSV into this account" onPress={() => save(true)} disabled={!valid} />
          <Card>
            <T.Mute>
              {txCount} transaction{txCount === 1 ? '' : 's'} in this account.
            </T.Mute>
            <Button
              ghost
              title={confirmDelete ? `Tap again to delete the account and its ${txCount} transactions` : 'Delete account'}
              onPress={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                dispatch({ type: 'deleteAccount', id: existing.id });
                router.back();
              }}
            />
            {confirmDelete ? <T.Mute style={s.neg}>This can’t be undone.</T.Mute> : null}
          </Card>
        </>
      ) : (
        <>
          <Button title="Save and import a CSV" onPress={() => save(true)} disabled={!valid} />
          <Button ghost title="Save without importing" onPress={() => save(false)} disabled={!valid} />
        </>
      )}
    </Screen>
  );
}
