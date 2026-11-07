import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Chips, Field, Label, Screen, Segmented } from '../../components/ui';
import { todayISO, useStore } from '../../data/store';
import { parseISO, toISO } from '../../lib/dates';

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && toISO(parseISO(v)) === v;

/** Manual transaction, e.g. cash spending. */
export default function NewTransaction() {
  const { state, dispatch } = useStore();
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO(state));
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const value = Number(amount);
  const valid = value > 0 && description.trim() && isDate(date) && accountId;

  const save = () => {
    dispatch({
      type: 'addTransaction',
      tx: {
        accountId,
        date,
        amount: direction === 'out' ? -value : value,
        description: description.trim(),
        categoryId,
      },
    });
    router.back();
  };

  return (
    <Screen>
      <Segmented
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'out', label: 'Money out' },
          { value: 'in', label: 'Money in' },
        ]}
      />
      <Field label="Amount ($)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="e.g. Farmers market" />
      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
      <Label>Account</Label>
      <Chips
        value={accountId}
        onChange={setAccountId}
        options={state.accounts.filter((a) => a.type !== 'kiwisaver').map((a) => ({ value: a.id, label: `${a.bank} ${a.name}` }))}
      />
      <Label>Category</Label>
      <Chips
        value={categoryId}
        onChange={setCategoryId}
        options={state.categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))}
      />
      <Button title="Add transaction" onPress={save} disabled={!valid} />
    </Screen>
  );
}
