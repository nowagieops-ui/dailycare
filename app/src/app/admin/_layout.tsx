import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';
import { tabIcon } from '../../lib/tab-icon';

export default function AdminTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Alerts', tabBarIcon: tabIcon('notifications-outline') }} />
      <Tabs.Screen name="shifts" options={{ title: 'Shifts', tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="staff" options={{ title: 'Staff', tabBarIcon: tabIcon('people-outline') }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: tabIcon('business-outline') }} />
      <Tabs.Screen name="announcements" options={{ title: 'Announce', tabBarIcon: tabIcon('megaphone-outline') }} />
      <Tabs.Screen name="training" options={{ href: null }} />
      <Tabs.Screen name="requests" options={{ href: null }} />
      <Tabs.Screen name="records" options={{ href: null }} />
    </Tabs>
  );
}
