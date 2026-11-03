import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useMyShifts } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Card, fmtTime, Muted, Tag } from '../../lib/ui';
import { addDays, sameDay, startOfWeek } from '../../lib/week';

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function Schedule() {
  const { profile } = useAuth();
  const { shifts, loading } = useMyShifts(profile?.uid, 24 * 8);
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const weekStart = addDays(startOfWeek(now), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const inWeek = shifts.filter((s) => {
    const d = new Date(s.start.toMillis());
    return d >= weekStart && d < addDays(weekStart, 7);
  });
  const hasShift = (d: Date) => inWeek.some((s) => sameDay(new Date(s.start.toMillis()), d));

  const statusOf = (s: (typeof shifts)[number]): { text: string; tone: 'green' | 'blue' | 'neutral' | 'amber' } => {
    if (s.status === 'completed') return { text: 'Completed', tone: 'green' };
    if (s.status === 'clocked_in') return { text: 'In progress', tone: 'green' };
    const mins = Math.round((s.start.toMillis() - Date.now()) / 60000);
    if (mins > 0 && mins <= 60) return { text: `In ${mins} min`, tone: 'amber' };
    return { text: 'Scheduled', tone: 'neutral' };
  };

  return (
    <StaffScreen title="Schedule">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d) => {
          const today = sameDay(d, now);
          return (
            <View key={d.toISOString()} style={{ alignItems: 'center', gap: 4, width: 42, paddingVertical: 8, borderRadius: 12, backgroundColor: today ? colors.primary : 'transparent' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: today ? '#fff' : colors.inkFaint }}>{DOW[d.getDay()]}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: today ? '#fff' : colors.ink }}>{d.getDate()}</Text>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hasShift(d) ? (today ? '#fff' : colors.primary) : 'transparent' }} />
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: colors.tint, borderRadius: 12, padding: 4 }}>
        {['This week', 'Next week'].map((label, i) => (
          <Pressable key={label} onPress={() => setOffset(i)} accessibilityRole="button" accessibilityState={{ selected: offset === i }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: offset === i ? colors.paper : 'transparent' }}>
            <Text style={{ fontWeight: '700', color: offset === i ? colors.primary : colors.inkSoft }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {!loading && inWeek.length === 0 && <Muted>No shifts this week.</Muted>}
      {inWeek.map((sh) => {
        const d = new Date(sh.start.toMillis());
        const st = statusOf(sh);
        const label = `${sameDay(d, now) ? 'Today · ' : ''}${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
        return (
          <View key={sh.id} style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.inkSoft }}>{label}</Text>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{sh.clientName}</Text>
                <Tag text={st.text} tone={st.tone} />
              </View>
              <Muted>{fmtTime(sh.start.toMillis())} – {fmtTime(sh.end.toMillis())} · {sh.serviceLine}</Muted>
              {sameDay(d, now) && <Muted>{sh.address}</Muted>}
            </Card>
          </View>
        );
      })}
    </StaffScreen>
  );
}
