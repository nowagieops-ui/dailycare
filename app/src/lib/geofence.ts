import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { collection, addDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export const GEOFENCE_TASK = 'dcs-shift-geofence';
// Platforms ignore very small geofences, so never go below this.
const MIN_RADIUS_M = 100;

// Runs in the background (also when the app is closed). Only EXIT events matter:
// walking around inside the radius never fires anything.
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };
  if (eventType !== Location.GeofencingEventType.Exit) return;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || !region.identifier) return;
  const shiftSnap = await getDoc(doc(db, 'shifts', region.identifier));
  const shift = shiftSnap.data();
  if (!shift || shift.status !== 'clocked_in' || shift.staffId !== user.uid) return;
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  await addDoc(collection(db, 'alerts'), {
    type: 'left_site',
    shiftId: shiftSnap.id,
    staffId: user.uid,
    staffName: userSnap.data()?.name ?? '',
    clientName: shift.clientName,
    at: Timestamp.now(),
    resolved: false,
  });
});

export async function requestLocationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

export async function startShiftGeofence(shiftId: string, lat: number, lng: number, radiusM: number) {
  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: shiftId,
      latitude: lat,
      longitude: lng,
      radius: Math.max(radiusM, MIN_RADIUS_M),
      notifyOnEnter: false,
      notifyOnExit: true,
    },
  ]);
}

export async function stopShiftGeofence() {
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}
