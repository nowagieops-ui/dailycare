import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Records where a DSP is while clocked in (every ~5 minutes or 50 m), so management can see unauthorised departures
 * during a shift and not only at clock-in. It stops the moment they clock out, and the phone shows a notification
 * while it runs. Mobile apps only.
 */
export const TRACK_TASK = 'dcs-shift-track';
const KEY = 'dcs-tracking-shift';

if (Platform.OS !== 'web') {
  TaskManager.defineTask(TRACK_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    const shiftId = await AsyncStorage.getItem(KEY);
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!shiftId || !user) return;
    for (const l of locations) {
      await addDoc(collection(db, 'shiftTrack'), {
        shiftId, staffId: user.uid, lat: l.coords.latitude, lng: l.coords.longitude, acc: Math.round(l.coords.accuracy ?? 0),
        at: Timestamp.fromMillis(l.timestamp),
      }).catch(() => {});
    }
  });
}

export async function startTracking(shiftId: string, _uid: string) {
  if (Platform.OS === 'web') return;
  await AsyncStorage.setItem(KEY, shiftId);
  if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) return;
  await Location.startLocationUpdatesAsync(TRACK_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5 * 60 * 1000,
    distanceInterval: 50,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Daily Care Support',
      notificationBody: 'Sharing your location with your supervisor while you are clocked in.',
    },
  });
}

export async function stopTracking() {
  if (Platform.OS === 'web') return;
  await AsyncStorage.removeItem(KEY);
  if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) await Location.stopLocationUpdatesAsync(TRACK_TASK);
}
