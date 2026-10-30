import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';
import { tabIcon } from '../../lib/tab-icon';

export default function StaffTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="clock-in" options={{ title: 'Clock In', tabBarIcon: tabIcon('time-outline') }} />
      <Tabs.Screen name="notes" options={{ title: 'Daily Notes', tabBarIcon: tabIcon('document-text-outline') }} />
      <Tabs.Screen name="training" options={{ href: null }} />
      <Tabs.Screen name="missed" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="files" options={{ href: null }} />
    </Tabs>
  );
}
