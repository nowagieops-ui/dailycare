import { Tabs } from 'expo-router';
import { colors } from '../../lib/theme';
import { tabIcon } from '../../lib/tab-icon';

// Tab bar follows the mockup (Home, Schedule, Clock, Tasks, Docs) plus the owner's two changes:
// "Clock" is "Clock In", and a new "Notes" tab for the daily note.
const HIDDEN = ['form-fill', 'chat', 'chat-thread', 'announcements', 'document', 'training', 'missed', 'calendar', 'files', 'settings', 'notifications'];

export default function StaffTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: tabIcon('calendar-outline') }} />
      <Tabs.Screen name="clock-in" options={{ title: 'Clock In', tabBarIcon: tabIcon('time-outline') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: tabIcon('checkbox-outline') }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes', tabBarIcon: tabIcon('create-outline') }} />
      <Tabs.Screen name="documents" options={{ title: 'Docs', tabBarIcon: tabIcon('document-text-outline') }} />
      {HIDDEN.map((n) => <Tabs.Screen key={n} name={n} options={{ href: null }} />)}
    </Tabs>
  );
}
