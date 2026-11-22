import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { useMyShifts } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Card, fmtTime, Muted, Tag } from '../../lib/ui';
import { addDays, hoursScheduled, hoursWorked, OVERTIME_AFTER_HOURS, payPeriodStart, sameDay } from '../../lib/week';
import type { Shift } from '../../lib/types';

const fmtDay = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
const hrs = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} h`;

function workedOf(s: Shift, now: number): number {
  if (!s.clockInAt) return 0;
  const end = s.clockOutAt ? s.clockOutAt.toMillis() : Math.min(now, s.end.toMillis());
  return Math.max(0, Math.round(((end - s.clockInAt.toMillis()) / 3600000) * 10) / 10);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 90, gap: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkFaint }}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: tone ?? colors.ink }}>{value}</Text>
    </View>
  );
}

/** Pay-period schedule: Thursday–Wednesday weeks, two to a period, with past periods and hours. */
export default function Schedule() {
  const { profile } = useAuth();
  const { shifts, loading } = useMyShifts(profile?.uid, 24 * 120);
  const [offset, setOffset] = useState(0); // pay periods from the current one
  const now = new Date();
  const nowMs = now.getTime();
  const periodStart = addDays(payPeriodStart(now), offset * 14);
  const periodEnd = addDays(periodStart, 14);
  const weeks = [0, 1].map((i) => ({ from: addDays(periodStart, i * 7), to: addDays(periodStart, i * 7 + 7) }));

  const inRange = (from: Date, to: Date) => shifts.filter((s) => s.start.toMillis() >= from.getTime() && s.start.toMillis() < to.getTime());
  const weekWorked = weeks.map((w) => hoursWorked(shifts, w.from, w.to, nowMs));
  const worked = weekWorked.reduce((a, b) => a + b, 0);
  const overtime = weekWorked.reduce((a, b) => a + Math.max(0, b - OVERTIME_AFTER_HOURS), 0);
  const scheduled = hoursScheduled(shifts, periodStart, periodEnd);
  const isCurrent = offset === 0;

  const statusOf = (s: Shift): { text: string; tone: 'green' | 'blue' | 'neutral' | 'amber' } => {
    if (s.status === 'completed') return { text: 'Completed', tone: 'green' };
    if (s.status === 'clocked_in') return { text: 'In progress', tone: 'green' };
    if (s.end.toMillis() < nowMs) return { text: 'Missed', tone: 'amber' };
    const mins = Math.round((s.start.toMillis() - nowMs) / 60000);
    if (mins > 0 && mins <= 60) return { text: `In ${mins} min`, tone: 'amber' };
    return { text: 'Scheduled', tone: 'neutral' };
  };

  const nav = (icon: 'chevron-back' | 'chevron-forward', d: number, label: string) => (
    <Pressable onPress={() => setOffset((o) => o + d)} accessibilityRole="button" accessibilityLabel={label}
      style={{ padding: 8, borderRadius: 10, backgroundColor: colors.tint }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </Pressable>
  );

  return (
    <StaffScreen title="Schedule">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {nav('chevron-back', -1, 'Previous pay period')}
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{fmtDay(periodStart)} – {fmtDay(addDays(periodEnd, -1))}</Text>
          <Muted>{isCurrent ? 'Current pay period' : offset < 0 ? 'Past pay period' : 'Upcoming pay period'}</Muted>
        </View>
        {nav('chevron-forward', 1, 'Next pay period')}
      </View>
      {!isCurrent && (
        <Pressable onPress={() => setOffset(0)} accessibilityRole="button" style={{ alignSelf: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Back to current period</Text>
        </Pressable>
      )}

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Stat label="Scheduled" value={hrs(scheduled)} />
          <Stat label="Worked" value={hrs(Math.round(worked * 10) / 10)} tone={colors.primary} />
          <Stat label="Regular" value={hrs(Math.round((worked - overtime) * 10) / 10)} />
          <Stat label="Overtime" value={hrs(Math.round(overtime * 10) / 10)} tone={overtime > 0 ? colors.red : undefined} />
        </View>
        <Muted>Overtime is anything over {OVERTIME_AFTER_HOURS} worked hours in a Thursday–Wednesday week.</Muted>
      </Card>

      {!loading && inRange(periodStart, periodEnd).length === 0 && <Muted>No shifts in this pay period.</Muted>}

      {weeks.map((w, i) => {
        const list = inRange(w.from, w.to);
        return (
          <View key={i} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>Week {i + 1} · {fmtDay(w.from)} – {fmtDay(addDays(w.to, -1))}</Text>
              <Muted>Scheduled {hrs(hoursScheduled(shifts, w.from, w.to))} · Worked {hrs(weekWorked[i])}</Muted>
            </View>
            {list.length === 0 && <Muted>No shifts this week.</Muted>}
            {list.map((sh) => {
              const d = new Date(sh.start.toMillis());
              const st = statusOf(sh);
              const w2 = workedOf(sh, nowMs);
              return (
                <Card key={sh.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '800', color: colors.ink }}>
                      {sameDay(d, now) ? 'Today · ' : ''}{d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                    </Text>
                    <Tag text={st.text} tone={st.tone} />
                  </View>
                  <Text style={{ color: colors.ink }}>{sh.clientName} · {fmtTime(sh.start.toMillis())} – {fmtTime(sh.end.toMillis())}</Text>
                  <Muted>
                    Scheduled {hrs(Math.round(((sh.end.toMillis() - sh.start.toMillis()) / 3600000) * 10) / 10)}
                    {sh.clockInAt ? ` · Worked ${hrs(w2)} (${fmtTime(sh.clockInAt.toMillis())}${sh.clockOutAt ? ` – ${fmtTime(sh.clockOutAt.toMillis())}` : ' – now'})` : ''}
                  </Muted>
                  {sameDay(d, now) && <Muted>{sh.address}</Muted>}
                </Card>
              );
            })}
          </View>
        );
      })}
    </StaffScreen>
  );
}
