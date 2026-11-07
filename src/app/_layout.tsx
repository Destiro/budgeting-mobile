import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../components/theme';
import { StoreProvider } from '../data/store';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.ink,
            contentStyle: { backgroundColor: colors.bg },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="goal/[id]" options={{ title: '' }} />
          <Stack.Screen name="goal/edit" options={{ title: 'Goal', presentation: 'modal' }} />
          <Stack.Screen name="td/edit" options={{ title: 'Term deposit', presentation: 'modal' }} />
          <Stack.Screen name="transaction/[id]" options={{ title: 'Categorise', presentation: 'modal' }} />
          <Stack.Screen name="transaction/new" options={{ title: 'Add transaction', presentation: 'modal' }} />
          <Stack.Screen name="quick-add" options={{ title: 'Add', presentation: 'modal' }} />
          <Stack.Screen name="connect" options={{ title: 'Add accounts' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
