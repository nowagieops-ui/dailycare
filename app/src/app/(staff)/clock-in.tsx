import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../lib/auth';
import { distanceM, isWithinSite } from '../../lib/geo';
import { requestLocationPermissions, startShiftGeofence, stopShiftGeofence } from '../../lib/geofence';
import { formsBlocker, formsForShift, useShiftSubmissions, useTemplates } from '../../lib/forms';
import { clockIn, clockOut, clockOutBlocker, isShiftTime, pickCurrent, useMyShifts } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Btn, Card, fmtTime, Muted } from '../../lib/ui';

type Range = { state: 'idle' } | { state: 'denied' } | { state: 'within' } | { state: 'outside'; metres: number };

export default function ClockIn() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid);
  const shift = pickCurrent(shifts);
  const templates = useTemplates();
  const subs = useShiftSubmissions(shift?.id, profile?.uid);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [range, setRange] = useState<Range>({ state: 'idle' });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Live "within range" check while this screen is open and a shift is due.
  const shiftId = shift?.id;
  const ready = shift ? isShiftTime(shift) : false;
  useEffect(() => {
    if (!shift || !ready || shift.status !== 'scheduled') return;
    let stop = false;
    const check = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return !stop && setRange({ state: 'denied' });
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (stop) return;
        const { latitude: la, longitude: lo, accuracy } = p.coords;
        setRange(isWithinSite(la, lo, accuracy, shift.lat, shift.lng, shift.radiusM)
          ? { state: 'within' } : { state: 'outside', metres: Math.round(distanceM(la, lo, shift.lat, shift.lng)) });
      } catch { /* leave as-is */ }
    };
    check();
    const t = setInterval(check, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [shiftId, ready, shift?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shift) {
    return <StaffScreen title="Clock In / Out"><Muted>You have no upcoming shift.</Muted></StaffScreen>;
  }

  async function doClockIn() {
    if (!shift) return;
    setBusy(true);
    setMsg('');
    try {
      if (!(await requestLocationPermissions())) {
        return setMsg('Location permission ("Always") is required to clock in.');
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      if (!isWithinSite(lat, lng, accuracy, shift.lat, shift.lng, shift.radiusM)) {
        const d = Math.round(distanceM(lat, lng, shift.lat, shift.lng));
        return setMsg(`You are about ${d} m from ${shift.clientName}. Go to the client's address to clock in.`);
      }
      await clockIn(shift, lat, lng);
      await startShiftGeofence(shift.id, shift.lat, shift.lng, shift.radiusM).catch(() => {});
    } catch {
      setMsg('Could not get your location. Check that location is on and try again.');
    } finally { setBusy(false); }
  }

  async function doClockOut() {
    if (!shift) return;
    setBusy(true);
    try { await clockOut(shift); await stopShiftGeofence().catch(() => {}); } finally { setBusy(false); }
  }

  const blocker = clockOutBlocker(shift) ?? formsBlocker(formsForShift(templates, shift), subs);
  const rangeText =
    range.state === 'within' ? 'Within range' : range.state === 'outside' ? `${range.metres} m from the client` :
    range.state === 'denied' ? 'Location is off' : 'Checking your location…';
  const rangeColor = range.state === 'within' ? colors.green : range.state === 'idle' ? colors.inkFaint : colors.red;

  return (
    <StaffScreen title="Clock In / Out">
      <View style={{ alignItems: 'center', gap: 2, paddingVertical: 8 }}>
        <Muted>{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Muted>
        <Text style={{ fontSize: 40, fontWeight: '800', color: colors.navy }}>
          {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700' }}>{shift.clientName} — {shift.serviceLine}</Text>
        {shift.status === 'scheduled' && ready && (
          <Text style={{ color: rangeColor, fontWeight: '600', fontSize: 13 }}>{rangeText} · {shift.address}</Text>
        )}
        <Muted>{fmtTime(shift.start.toMillis())} – {fmtTime(shift.end.toMillis())}</Muted>
      </Card>

      {!ready && <Muted>Clock-in opens 15 minutes before your shift starts.</Muted>}

      {ready && shift.status === 'scheduled' && (
        <>
          <Btn label="Clock In" onPress={doClockIn} busy={busy} />
          <Muted>Tap to start your visit with {shift.clientName}.</Muted>
        </>
      )}

      {shift.status === 'clocked_in' && (
        <>
          <Card style={{ backgroundColor: colors.greenBg, borderColor: colors.greenBg }}>
            <Text style={{ color: colors.green, fontWeight: '700' }}>
              Clocked in at {shift.clockInAt ? fmtTime(shift.clockInAt.toMillis()) : ''}
            </Text>
          </Card>
          {blocker && (
            <Card>
              <Text style={{ color: colors.amber, fontWeight: '700' }}>Before you can clock out</Text>
              <Muted>{blocker}.</Muted>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Link href="/tasks" style={{ color: colors.primary, fontWeight: '700' }}>Open Tasks →</Link>
                <Link href="/notes" style={{ color: colors.primary, fontWeight: '700' }}>Open Notes →</Link>
              </View>
            </Card>
          )}
          <Btn label="Clock Out" tone="danger" onPress={doClockOut} busy={busy} disabled={!!blocker} />
        </>
      )}
      {msg ? <Text style={{ color: colors.red }}>{msg}</Text> : null}
      <Pressable><Link href="/missed" style={{ color: colors.primary, fontWeight: '600', textAlign: 'center' }}>Report a missed clock-in instead</Link></Pressable>
    </StaffScreen>
  );
}
