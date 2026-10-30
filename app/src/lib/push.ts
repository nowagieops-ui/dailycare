import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

/** Ask for permission and store this device's push token so reminders and alerts can reach it. */
export async function registerForPush(uid: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return; // set once the EAS project exists
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await setDoc(doc(db, 'pushTokens', uid), { token, platform: Platform.OS, updatedAt: Timestamp.now() });
  } catch {
    // Push is best-effort; never block sign-in on it.
  }
}
