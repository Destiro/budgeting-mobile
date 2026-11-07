import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Text, View } from 'react-native';

import { colors } from '../../components/theme';

const icon = (glyph: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>;
  };

function AddIcon() {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.ink,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
      }}
    >
      <Text style={{ color: colors.card, fontSize: 26, lineHeight: 28, fontWeight: '300' }}>+</Text>
    </View>
  );
}

/** Wireframe option 8B: four tabs plus a centre quick-add button; settings live behind the avatar on Home. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('🏡') }} />
      <Tabs.Screen name="spending" options={{ title: 'Spending', tabBarIcon: icon('📊') }} />
      <Tabs.Screen
        name="add"
        options={{ title: '', tabBarIcon: AddIcon, tabBarAccessibilityLabel: 'Add' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/quick-add');
          },
        }}
      />
      <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarIcon: icon('🎯') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('🏦') }} />
    </Tabs>
  );
}
