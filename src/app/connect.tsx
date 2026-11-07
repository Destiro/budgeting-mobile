import { router } from 'expo-router';

import { Button, Card, Screen, T } from '../components/ui';

/** Wireframe 7: add a bank. Akahu sync and CSV import are the next milestones. */
export default function Connect() {
  return (
    <Screen>
      <Card>
        <T.H>🔗 Connect with Akahu</T.H>
        <T.Mute>Automatic, read-only sync for BNZ, ASB and other NZ banks.</T.Mute>
        <Button title="Coming soon" onPress={() => {}} disabled />
      </Card>
      <Card>
        <T.H>📄 Import CSV</T.H>
        <T.Mute>Export transactions from BNZ or ASB internet banking and import the file here.</T.Mute>
        <Button ghost title="Coming soon" onPress={() => {}} disabled />
      </Card>
      <Card>
        <T.H>✏️ Manual</T.H>
        <T.Mute>Add a term deposit now. Manual savings, KiwiSaver and loan accounts are coming.</T.Mute>
        <Button ghost title="Add a term deposit" onPress={() => router.push('/td/edit')} />
      </Card>
    </Screen>
  );
}
