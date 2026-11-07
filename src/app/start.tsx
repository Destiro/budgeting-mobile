import { router } from 'expo-router';
import { Platform } from 'react-native';

import { Button, Card, Row, Screen, T } from '../components/ui';
import { useStore } from '../data/store';

/** Leave the demo and start with your own accounts. */
export default function Start() {
  const { dispatch } = useStore();
  return (
    <Screen>
      <Card>
        <T.H>What happens</T.H>
        <Row wrap icon="🧹" left="Demo accounts, transactions, goals and term deposits are cleared" />
        <Row wrap icon="📌" left="Categories, merchant rules, budgets and settings are kept" />
        <Row
          icon="📱"
          left={Platform.OS === 'web' ? 'Your data is saved in this browser only' : 'Your data is saved on this phone only'}
          last
        />
      </Card>
      <Card>
        <T.H>Then</T.H>
        <Row wrap icon="1" left="Add your accounts: ASB pay and rent, BNZ everyday, savings and credit card" />
        <Row wrap icon="2" left="Import a CSV from internet banking for each one" />
        <Row wrap icon="3" left="Add your term deposit" />
        <Row wrap icon="4" left="Set up your goal, counting your savings account and term deposit" last />
      </Card>
      <Button
        title="Clear demo data and start"
        onPress={() => {
          dispatch({ type: 'startOwn' });
          router.dismissTo('/');
        }}
      />
      <T.Mute>You can go back to the demo any time from Settings.</T.Mute>
    </Screen>
  );
}
