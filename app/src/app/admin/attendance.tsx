import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { useShiftsBetween } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { csvSafe } from '../../lib/csv';
import { db } from '../../lib/firebase';
import { distanceM } from '../../lib/geo';
import { colors } from '../../lib/theme';
import { canAdminister, type Shift } from '../../lib/types';
import { Btn, Card, fmtTime, Muted, s, Screen, StatTile, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';

const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const hrs = (x: Shift) => (x.clockInAt && x.clockOutAt ? (x.clockOutAt.toMillis() - x.clockInAt.toMillis()) / 3600000 : 0);

type Flag = { text: string; tone: 'green' | 'amber' | 'red' | 'neutral'; review: boolean };
function flagOf(x: Shift, now = Date.now()): Flag {
  if (!x.clockInAt) {
    return x.end.toMillis() < now ? { text: 'Missed clock-in', tone: 'red', review: true } : { text: 'Upcoming', tone: 'neutral', review: false };
  }
  if (x.clockInLat != null && x.clockInLng != null && distanceM(x.clockInLat, x.clockInLng, x.lat, x.lng) > x.radiusM) {
    return { text: 'GPS mismatch', tone: 'amber', review: true };
  }
  const late = Math.round((x.clockInAt.toMillis() - x.start.toMillis()) / 60000);
  if (late > 5) return { text: `Late ${late} min`, tone: 'amber', review: false };
  return { text: 'On time', tone: 'green', review: false };
}

export default function Attendance() {
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const sunday = addDays(monday, 6);
  const canEdit = canAdminister(useAuth().profile?.role);
  const rows = useShiftsBetween(monday, addDays(monday, 7)).filter((x) => x.staffId).sort((a, b) => a.start.toMillis() - b.start.toMillis());
  const flags = useMemo(() => new Map(rows.map((x) => [x.id, flagOf(x)])), [rows]);
  const total = rows.reduce((n, x) => n + hrs(x), 0);
  const missed = rows.filter((x) => flags.get(x.id)?.text === 'Missed clock-in').length;
  const flagged = rows.filter((x) => flags.get(x.id)?.review && !x.approved).length;
  const fmtD = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const W = [1.4, 2, 1.6, 1.6, 0.7, 1.2, 0.9];

  function exportCsv() {
    const lines = [['date', 'staff', 'client', 'scheduled_start', 'scheduled_end', 'clock_in', 'clock_out', 'hours', 'flag', 'approved']];
    for (const x of rows) {
      lines.push([
        x.start.toDate().toISOString().slice(0, 10), x.staffName ?? '', x.clientName, fmtTime(x.start.toMillis()), fmtTime(x.end.toMillis()),
        x.clockInAt ? fmtTime(x.clockInAt.toMillis()) : '', x.clockOutAt ? fmtTime(x.clockOutAt.toMillis()) : '',
        hrs(x).toFixed(2), flags.get(x.id)?.text ?? '', x.approved ? 'yes' : 'no',
      ]);
    }
    const csv = lines.map((r) => r.map((v) => `"${csvSafe(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `timesheets-${monday.toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Screen title="Time & Attendance">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityLabel="Previous week" onPress={() => setMonday(addDays(monday, -7))} style={{ padding: 6 }}><Text style={{ fontSize: 18, color: colors.primary }}>‹</Text></Pressable>
          <Text style={s.h2}>{fmtD(monday)} – {fmtD(sunday)}, {sunday.getFullYear()}</Text>
          <Pressable accessibilityLabel="Next week" onPress={() => setMonday(addDays(monday, 7))} style={{ padding: 6 }}><Text style={{ fontSize: 18, color: colors.primary }}>›</Text></Pressable>
        </View>
        {Platform.OS === 'web' && <View style={{ width: 190 }}><Btn label="Export to payroll (CSV)" onPress={exportCsv} /></View>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Hours logged this week" value={total.toFixed(1)} /></View>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Missed clock-ins" value={missed} /></View>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Flagged for review" value={flagged} /></View>
      </View>
      <Card style={{ padding: 0 }}>
        <ScrollView horizontal>
          <View style={{ minWidth: 860 }}>
            <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
              {['Staff', 'Visit', 'Scheduled', 'Clocked in/out', 'Hours', 'Flag', ''].map((h, i) => <View key={i} style={{ flex: W[i], paddingRight: 8 }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{h}</Text></View>)}
            </View>
            {rows.length === 0 && <View style={{ padding: 12 }}><Muted>No shifts this week.</Muted></View>}
            {rows.map((x) => {
              const f = flags.get(x.id)!;
              return (
                <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
                  <View style={{ flex: W[0], paddingRight: 8 }}><Text style={{ fontWeight: '600', color: colors.ink }}>{x.staffName}</Text></View>
                  <View style={{ flex: W[1], paddingRight: 8 }}><Text style={{ color: colors.ink }}>{x.clientName} — {x.serviceLine}</Text></View>
                  <View style={{ flex: W[2], paddingRight: 8 }}><Text style={{ color: colors.inkSoft, fontSize: 13 }}>{x.start.toDate().toLocaleDateString([], { weekday: 'short' })} {fmtTime(x.start.toMillis())} – {fmtTime(x.end.toMillis())}</Text></View>
                  <View style={{ flex: W[3], paddingRight: 8 }}><Text style={{ color: colors.inkSoft, fontSize: 13 }}>{x.clockInAt ? `${fmtTime(x.clockInAt.toMillis())} – ${x.clockOutAt ? fmtTime(x.clockOutAt.toMillis()) : 'on shift'}` : '— not clocked in —'}</Text></View>
                  <View style={{ flex: W[4], paddingRight: 8 }}><Text style={{ color: colors.ink }}>{hrs(x).toFixed(2)}</Text></View>
                  <View style={{ flex: W[5], paddingRight: 8 }}><Tag text={f.text} tone={f.tone} /></View>
                  <View style={{ flex: W[6] }}>
                    {x.approved ? <Text style={{ color: colors.green, fontWeight: '600' }}>Approved</Text> : canEdit && (x.clockOutAt || f.review) ? (
                      <Pressable onPress={() => updateDoc(doc(db, 'shifts', x.id), { approved: true })}><Text style={{ color: colors.primary, fontWeight: '700' }}>{f.review ? 'Review & approve' : 'Approve'}</Text></Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Card>
    </Screen>
  );
}
