import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { isShiftTime, pickCurrent, saveTasks, useMyShifts } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Card, Muted, s } from '../../lib/ui';

export default function Tasks() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid);
  const shift = pickCurrent(shifts);

  if (!shift || !isShiftTime(shift)) {
    return (
      <StaffScreen title="Visit Checklist">
        <Muted>{shift ? 'Your checklist appears 15 minutes before the shift starts.' : 'No shift right now.'}</Muted>
      </StaffScreen>
    );
  }
  const done = shift.tasks.filter((t) => t.done).length;
  const locked = shift.status !== 'clocked_in';
  const toggle = (id: string) =>
    !locked && saveTasks(shift.id, shift.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <StaffScreen title="Visit Checklist">
      <Card>
        <Text style={s.h2}>{shift.clientName} — {shift.serviceLine}</Text>
        <Muted>{done} of {shift.tasks.length} complete</Muted>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.tint }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primary, width: `${shift.tasks.length ? (done / shift.tasks.length) * 100 : 0}%` }} />
        </View>
      </Card>
      {locked && <Muted>Clock in to start ticking off tasks.</Muted>}
      <Card>
        {shift.tasks.length === 0 && <Muted>No tasks were set for this visit.</Muted>}
        {shift.tasks.map((t) => (
          <Pressable key={t.id} onPress={() => toggle(t.id)} accessibilityRole="checkbox" accessibilityState={{ checked: t.done, disabled: locked }} style={{ paddingVertical: 10 }}>
            <Text style={{ fontSize: 15, color: t.done ? colors.green : colors.ink, opacity: locked ? 0.5 : 1 }}>
              {t.done ? '☑' : '☐'}  {t.label}
            </Text>
          </Pressable>
        ))}
      </Card>
      <Link href="/notes" style={{ color: colors.primary, fontWeight: '700' }}>Next: write today's note →</Link>
    </StaffScreen>
  );
}
