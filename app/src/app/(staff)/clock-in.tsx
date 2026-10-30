import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../lib/auth';
import { isWithinSite, distanceM } from '../../lib/geo';
import { requestLocationPermissions, startShiftGeofence, stopShiftGeofence } from '../../lib/geofence';
import {
  clockIn, clockOut, clockOutBlocker, isShiftTime, pickCurrent, saveTasks, useMyShifts,
} from '../../lib/shifts';
import { colors } from '../../lib/theme';
import { Btn, Card, fmtTime, Muted, s, Screen } from '../../lib/ui';

export default function ClockIn() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid);
  const shift = pickCurrent(shifts);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!shift) {
    return <Screen title="Clock In"><Muted>You have no upcoming shift.</Muted></Screen>;
  }

  async function doClockIn() {
    if (!shift) return;
    setBusy(true);
    setMsg('');
    try {
      if (!(await requestLocationPermissions())) {
        setMsg('Location permission ("Always") is required to clock in.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      if (!isWithinSite(lat, lng, accuracy, shift.lat, shift.lng, shift.radiusM)) {
        const d = Math.round(distanceM(lat, lng, shift.lat, shift.lng));
        setMsg(`You are about ${d} m from ${shift.clientName}. Go to the client's address to clock in.`);
        return;
      }
      await clockIn(shift, lat, lng);
      await startShiftGeofence(shift.id, shift.lat, shift.lng, shift.radiusM).catch(() => {});
    } catch {
      setMsg('Could not get your location. Check that location is on and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function doClockOut() {
    if (!shift) return;
    setBusy(true);
    try {
      await clockOut(shift);
      await stopShiftGeofence().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    if (!shift || shift.status !== 'clocked_in') return;
    saveTasks(shift.id, shift.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  const ready = isShiftTime(shift);
  const blocker = clockOutBlocker(shift);

  return (
    <Screen title="Clock In">
      <Card>
        <Text style={s.h2}>{shift.clientName}</Text>
        <Muted>{shift.address}</Muted>
        <Muted>{fmtTime(shift.start.toMillis())} – {fmtTime(shift.end.toMillis())}</Muted>
      </Card>

      {!ready && <Muted>Your checklist and clock-in unlock 15 minutes before the shift starts.</Muted>}

      {ready && shift.status === 'scheduled' && (
        <Btn label="Clock In" onPress={doClockIn} busy={busy} />
      )}

      {ready && shift.status === 'clocked_in' && (
        <>
          <Card>
            <Text style={s.h2}>Visit checklist</Text>
            {shift.tasks.map((t) => (
              <Pressable
                key={t.id} onPress={() => toggle(t.id)} accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done }} style={{ paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 16, color: t.done ? colors.green : colors.ink }}>
                  {t.done ? '☑' : '☐'}  {t.label}
                </Text>
              </Pressable>
            ))}
          </Card>
          {blocker && <Text style={{ color: colors.amber, fontWeight: '600' }}>To clock out: {blocker}.</Text>}
          <Btn label="Clock Out" tone="danger" onPress={doClockOut} busy={busy} disabled={!!blocker} />
        </>
      )}
      {msg ? <Text style={{ color: colors.red }}>{msg}</Text> : null}
    </Screen>
  );
}
