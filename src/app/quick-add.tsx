import { router } from 'expo-router';

import { Card, Row, Screen } from '../components/ui';

/** Quick-add menu opened from the centre tab (wireframe 8B). Route is /quick-add because /add is taken by the tab placeholder.. */
export default function Add() {
  const go = (path: '/transaction/new' | '/td/edit' | '/goal/edit') => router.replace(path);
  return (
    <Screen>
      <Card style={{ paddingVertical: 2 }}>
        <Row icon="🧾" left="Transaction" sub="Cash spending or anything the bank feed missed" onPress={() => go('/transaction/new')} right="›" />
        <Row icon="🏦" left="Term deposit" sub="Rate, term and what happens at maturity" onPress={() => go('/td/edit')} right="›" />
        <Row icon="🎯" left="Goal" sub="Target, date and what counts towards it" onPress={() => go('/goal/edit')} right="›" last />
      </Card>
    </Screen>
  );
}
