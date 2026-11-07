import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { colors } from '../../components/theme';
import { Button, Card, Chips, Screen, T, s } from '../../components/ui';
import { useStore } from '../../data/store';
import { merchantKey } from '../../lib/analytics';
import { parseISO, shortDate } from '../../lib/dates';
import { formatSigned } from '../../lib/money';

/** Wireframe 4: categorise a transaction, optionally creating a rule. */
export default function Categorise() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const tx = state.transactions.find((t) => t.id === id);
  const [categoryId, setCategoryId] = useState<string | null>(tx?.categoryId ?? null);
  const [makeRule, setMakeRule] = useState(!tx?.categoryId);
  if (!tx) return null;

  const account = state.accounts.find((a) => a.id === tx.accountId);
  const key = merchantKey(tx.description);
  const pair = tx.transferPairId ? state.transactions.find((t) => t.id === tx.transferPairId) : undefined;
  const pairAccount = pair ? state.accounts.find((a) => a.id === pair.accountId) : undefined;
  const matching = state.transactions.filter(
    (t) => t.id !== tx.id && t.description.toLowerCase().includes(key.toLowerCase()) && !t.categoryId,
  ).length;

  const save = () => {
    if (categoryId) dispatch({ type: 'categorise', id: tx.id, categoryId, makeRule });
    router.back();
  };

  return (
    <Screen>
      <View>
        <T.H>{tx.description}</T.H>
        <T.Big style={tx.amount > 0 ? s.pos : undefined}>{formatSigned(tx.amount)}</T.Big>
        <T.Mute>
          {shortDate(parseISO(tx.date))} · {account?.bank} {account?.name}
        </T.Mute>
      </View>

      <Chips
        value={categoryId}
        onChange={setCategoryId}
        options={state.categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))}
      />
      {pair && pairAccount && categoryId === 'transfer' ? (
        <T.Mute>
          Matched with {formatSigned(pair.amount)} {pair.amount > 0 ? 'into' : 'out of'} {pairAccount.bank} {pairAccount.name} on{' '}
          {shortDate(parseISO(pair.date))}. Both sides are left out of income and spending. Pick another category if this isn't a transfer.
        </T.Mute>
      ) : null}
      {categoryId === 'transfer' ? (
        <T.Mute>Transfers between your own accounts are left out of income and spending.</T.Mute>
      ) : null}

      <Card>
        <Pressable onPress={() => setMakeRule(!makeRule)} style={[s.between, { gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <T.Body>Always categorise “{key}” like this</T.Body>
            <T.Mute>
              {matching ? `Also applies to ${matching} other uncategorised transaction${matching === 1 ? '' : 's'}` : 'Applies to future transactions'}
            </T.Mute>
          </View>
          <Switch value={makeRule} onValueChange={setMakeRule} trackColor={{ true: colors.accent }} />
        </Pressable>
      </Card>

      <Button title="Save" onPress={save} disabled={!categoryId} />
    </Screen>
  );
}
