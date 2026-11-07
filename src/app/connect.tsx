import { router } from 'expo-router';

import { Button, Card, Screen, T } from '../components/ui';

/** Wireframe 7: ways to add accounts and transactions. Akahu sync comes later. */
export default function Connect() {
  return (
    <Screen>
      <Card>
        <T.H>🏦 Add an account</T.H>
        <T.Mute>Everyday, savings, credit card or KiwiSaver, with its current balance.</T.Mute>
        <Button title="Add an account" onPress={() => router.push('/account/edit')} />
      </Card>
      <Card>
        <T.H>📄 Import CSV</T.H>
        <T.Mute>Export transactions from BNZ or ASB internet banking and import the file into one of your accounts.</T.Mute>
        <Button ghost title="Import a CSV" onPress={() => router.push('/import')} />
      </Card>
      <Card>
        <T.H>📈 Term deposit</T.H>
        <T.Mute>Rate, term and what happens at maturity.</T.Mute>
        <Button ghost title="Add a term deposit" onPress={() => router.push('/td/edit')} />
      </Card>
      <Card>
        <T.H>🔗 Connect with Akahu</T.H>
        <T.Mute>Automatic, read-only sync for BNZ, ASB and other NZ banks. Coming later; CSV import works now.</T.Mute>
      </Card>
    </Screen>
  );
}
