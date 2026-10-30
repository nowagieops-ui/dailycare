import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';

export default function StaffTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="clock-in" options={{ title: 'Clock In' }} />
      <Tabs.Screen name="notes" options={{ title: 'Daily Notes' }} />
    </Tabs>
  );
}
