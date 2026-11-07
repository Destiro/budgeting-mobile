import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';

import { colors } from '../components/theme';
import { Button, Card, Chips, Field, Label, Row, Screen, T, s } from '../components/ui';
import { readPickedText } from '../data/files';
import { newId, useStore } from '../data/store';
import { CsvError, looksLikePurchasesArePositive, parseBankCSV, splitDuplicates, type ParsedFile } from '../lib/csv';
import { parseISO, shortDate } from '../lib/dates';
import { formatSigned } from '../lib/money';
import type { Transaction } from '../lib/types';

type Result = { imported: number; ids: Set<string> };

/** Import a CSV exported from BNZ or ASB internet banking into one account. */
export default function ImportCsv() {
  const params = useLocalSearchParams<{ accountId?: string }>();
  const { state, dispatch } = useStore();
  const accounts = state.accounts.filter((a) => a.type !== 'kiwisaver');
  const [accountId, setAccountId] = useState<string | null>(params.accountId ?? accounts[0]?.id ?? null);
  const account = state.accounts.find((a) => a.id === accountId);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [flip, setFlip] = useState(false);
  const [balance, setBalance] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const load = (text: string, name: string) => {
    setResult(null);
    try {
      const f = parseBankCSV(text);
      if (!f.rows.length) throw new CsvError('The file has a header row but no transactions we could read.');
      setParsed(f);
      setFileName(name);
      setError(null);
      setFlip(account?.type === 'credit' && looksLikePurchasesArePositive(f.rows));
      setBalance(f.balance !== undefined && account?.type !== 'credit' ? String(f.balance) : '');
    } catch (e) {
      setParsed(null);
      setError(e instanceof CsvError ? e.message : "That file couldn't be read as a CSV.");
    }
  };

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      // Phones often label CSVs inconsistently, so allow any file there and let the parser decide.
      type: Platform.OS === 'web' ? ['.csv', 'text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'] : '*/*',
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    try {
      load(await readPickedText(asset), asset.name);
    } catch {
      setError("That file couldn't be opened.");
    }
  };

  const rows = useMemo(
    () => (parsed ? parsed.rows.map((r) => (flip ? { ...r, amount: -r.amount } : r)) : []),
    [parsed, flip],
  );
  const split = useMemo(
    () => (accountId ? splitDuplicates(rows, state.transactions, accountId) : { fresh: [], duplicates: 0 }),
    [rows, state.transactions, accountId],
  );
  const range = rows.length
    ? rows.reduce((r, x) => ({ from: x.date < r.from ? x.date : r.from, to: x.date > r.to ? x.date : r.to }), {
        from: rows[0].date,
        to: rows[0].date,
      })
    : null;

  const doImport = () => {
    if (!accountId) return;
    const transactions: Transaction[] = split.fresh.map((r) => ({
      id: newId('tx'),
      accountId,
      date: r.date,
      amount: r.amount,
      description: r.description,
      categoryId: null,
      externalId: r.externalId,
    }));
    const bal = balance.trim() === '' ? undefined : Number(balance);
    dispatch({
      type: 'importTransactions',
      accountId,
      transactions,
      balance: bal !== undefined && !Number.isNaN(bal) ? (account?.type === 'credit' ? -Math.abs(bal) : bal) : undefined,
    });
    setResult({ imported: transactions.length, ids: new Set(transactions.map((t) => t.id)) });
    setParsed(null);
    setPasted('');
    setPasting(false);
  };

  // After importing, read the outcome from the store (rules and transfer matching have run).
  const outcome = result
    ? state.transactions.reduce(
        (o, t) => {
          if (!result.ids.has(t.id)) return o;
          if (t.categoryId === 'transfer') o.transfers++;
          else if (!t.categoryId) o.uncategorised++;
          return o;
        },
        { transfers: 0, uncategorised: 0 },
      )
    : null;

  if (!accounts.length) {
    return (
      <Screen>
        <Card>
          <T.H>Add an account first</T.H>
          <T.Mute>Transactions are imported into one of your accounts. Add the account the CSV came from, then come back.</T.Mute>
          <Button title="Add an account" onPress={() => router.push('/account/edit')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Label>Import into</Label>
      <Chips
        value={accountId}
        onChange={(id) => {
          setAccountId(id);
          setResult(null);
          const a = state.accounts.find((x) => x.id === id);
          if (parsed) setFlip(a?.type === 'credit' && looksLikePurchasesArePositive(parsed.rows));
        }}
        options={accounts.map((a) => ({ value: a.id, label: `${a.bank} ${a.name}` }))}
      />

      {outcome && result ? (
        <Card>
          <T.H>Imported {result.imported} transaction{result.imported === 1 ? '' : 's'}</T.H>
          <Row left="Matched as transfers between your accounts" right={String(outcome.transfers)} />
          <Row
            left="Categorised by your rules"
            right={String(result.imported - outcome.transfers - outcome.uncategorised)}
          />
          <Row left="Left for you to categorise" right={String(outcome.uncategorised)} rightStyle={outcome.uncategorised ? s.neg : undefined} last />
          <T.Mute>
            Transfers pair up once both accounts are imported. Import your other accounts next and more will match.
          </T.Mute>
          {outcome.uncategorised ? (
            <Button
              title="Categorise now"
              onPress={() => router.navigate({ pathname: '/spending', params: { view: 'transactions', filter: 'uncategorised', at: String(Date.now()) } })}
            />
          ) : null}
          <Button ghost title="Import another file" onPress={() => setResult(null)} />
        </Card>
      ) : null}

      {!result ? (
        <>
          <Card>
            <T.H>Get the CSV from internet banking</T.H>
            <T.Mute>
              In ASB or BNZ internet banking, open the account and look for the option to export or download
              transactions, and choose CSV. The website usually has this when the banking app doesn’t. Save the
              file, then choose it below.
            </T.Mute>
            <Button title={fileName && parsed ? `Chosen: ${fileName}` : 'Choose CSV file'} onPress={pick} ghost={!!parsed} />
            <Pressable onPress={() => setPasting(!pasting)} hitSlop={8}>
              <T.Mute style={{ textDecorationLine: 'underline' }}>{pasting ? 'Hide paste box' : 'Or paste the CSV text'}</T.Mute>
            </Pressable>
            {pasting ? (
              <>
                <Field
                  label="CSV text"
                  value={pasted}
                  onChangeText={setPasted}
                  multiline
                  style={{ backgroundColor: colors.bg, minHeight: 120 }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button ghost title="Read pasted text" onPress={() => load(pasted, 'pasted text')} disabled={!pasted.trim()} />
              </>
            ) : null}
          </Card>
          {error ? <T.Body style={s.neg}>{error}</T.Body> : null}
        </>
      ) : null}

      {parsed && range ? (
        <>
          <Card>
            <T.H>
              {parsed.format === 'CSV' ? 'CSV file' : `${parsed.format} export`} · {rows.length} transactions
            </T.H>
            <T.Mute>
              {shortDate(parseISO(range.from))} – {shortDate(parseISO(range.to))}
              {parsed.skipped ? ` · ${parsed.skipped} row${parsed.skipped === 1 ? '' : 's'} couldn't be read` : ''}
            </T.Mute>
            <Row left="New" right={String(split.fresh.length)} />
            <Row left="Already imported (skipped)" right={String(split.duplicates)} last />
          </Card>

          {account?.type === 'credit' ? (
            <Card>
              <Pressable onPress={() => setFlip(!flip)} style={[s.between, { gap: 12 }]}>
                <View style={{ flex: 1 }}>
                  <T.Body>Flip signs for this card</T.Body>
                  <T.Mute>
                    Purchases should show as money out (−). Some card exports list them as positive.
                    {looksLikePurchasesArePositive(parsed.rows) ? ' This file looks like one of those, so flipping is on.' : ''}
                  </T.Mute>
                </View>
                <Switch value={flip} onValueChange={setFlip} trackColor={{ true: colors.accent }} />
              </Pressable>
            </Card>
          ) : null}

          <Card style={{ paddingVertical: 2 }}>
            {rows.slice(0, 5).map((r, i) => (
              <Row
                key={i}
                left={r.description}
                sub={shortDate(parseISO(r.date))}
                right={formatSigned(r.amount)}
                rightStyle={r.amount > 0 ? s.pos : undefined}
                last={i === Math.min(4, rows.length - 1)}
              />
            ))}
          </Card>

          <Field
            label={account?.type === 'credit' ? 'Amount owing on the card now ($, optional)' : 'Balance now ($, optional)'}
            value={balance}
            onChangeText={setBalance}
            keyboardType="numbers-and-punctuation"
            placeholder={account ? String(Math.abs(account.balance)) : ''}
          />
          <Button
            title={split.fresh.length ? `Import ${split.fresh.length} transaction${split.fresh.length === 1 ? '' : 's'}` : 'Nothing new to import'}
            onPress={doImport}
            disabled={!split.fresh.length || !accountId}
          />
        </>
      ) : null}
    </Screen>
  );
}
