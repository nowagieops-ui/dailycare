import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

export default function AdminTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="shifts" options={{ title: 'Shifts' }} />
      <Tabs.Screen name="staff" options={{ title: 'Staff' }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients' }} />
      <Tabs.Screen name="announcements" options={{ title: 'Announce' }} />
      <Tabs.Screen name="training" options={{ href: null }} />
      <Tabs.Screen name="requests" options={{ href: null }} />
      <Tabs.Screen name="records" options={{ href: null }} />
    </Tabs>
  );
}
