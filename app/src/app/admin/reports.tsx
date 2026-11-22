import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useShiftsBetween, useStaff } from '../../lib/admin-data';
import { hasTraining, useCredentials, useRequiredTrainings } from '../../lib/credentials';
import { signingStatus, useFolderTemplate, useAdminDocs, useAllSignatures } from '../../lib/ebinder';
import { daysLeft } from '../../lib/expiry';
import { colors } from '../../lib/theme';
import type { Shift } from '../../lib/types';
import { Card, initials, Muted, s, Screen, StatTile, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';

const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
const show = (v: number | null) => (v == null ? '—' : `${v}%`);
const sched = (x: Shift) => (x.end.toMillis() - x.start.toMillis()) / 3600000;
const worked = (x: Shift) => (x.clockInAt && x.clockOutAt ? (x.clockOutAt.toMillis() - x.clockInAt.toMillis()) / 3600000 : 0);
const onTime = (x: Shift) => !!x.clockInAt && x.clockInAt.toMillis() - x.start.toMillis() <= 5 * 60000;

export default function Reports() {
  const template = useFolderTemplate();
  const now = Date.now();
  const thisMon = useMemo(() => mondayOf(new Date()), []);
  const from = addDays(thisMon, -35);
  const all = useShiftsBetween(from, addDays(thisMon, 7)).filter((x) => x.staffId);
  const staff = useStaff().filter((u) => (u.role === 'staff' || u.role === 'family_staff') && u.active);
  const creds = useCredentials();
  const required = useRequiredTrainings();
  const docs = useAdminDocs();
  const sigs = useAllSignatures();

  const past = all.filter((x) => x.end.toMillis() < now);
  const staffRow = (id: string) => {
    const mine = past.filter((x) => x.staffId === id);
    const c = creds.filter((k) => k.staffId === id);
    return {
      attendance: pct(mine.filter((x) => x.clockInAt).length, mine.length),
      credentials: pct(c.filter((k) => daysLeft(k.expiresOn.toMillis()) >= 0).length, c.length),
      ebinder: (() => { const st = signingStatus(docs, sigs, id); return pct(st.filter((x) => x.signed).length, st.length); })(),
      training: pct(required.filter((t) => hasTraining(creds, id, t)).length, required.length),
    };
  };
  const rows = staff.map((u) => ({ u, ...staffRow(u.id) }));
  const avg = (xs: (number | null)[]) => { const v = xs.filter((n): n is number => n != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

  const weeks = Array.from({ length: 6 }, (_, i) => {
    const a = addDays(thisMon, (i - 5) * 7), b = addDays(a, 7);
    const w = past.filter((x) => x.start.toMillis() >= a.getTime() && x.start.toMillis() < b.getTime());
    return pct(w.filter(onTime).length, w.length);
  });

  const thisWeek = all.filter((x) => x.start.toMillis() >= thisMon.getTime());
  const util = staff.map((u) => {
    const mine = thisWeek.filter((x) => x.staffId === u.id && x.end.toMillis() < now);
    const sh = mine.reduce((n, x) => n + sched(x), 0), wh = mine.reduce((n, x) => n + worked(x), 0);
    return { u, sh, wh, pct: pct(wh, sh) };
  });

  const status = (...all: (number | null)[]) => {
    const v = all.filter((n): n is number => n != null);
    if (!v.length) return <Tag text="No data yet" />;
    return Math.min(...v) < 80 ? <Tag text="Needs attention" tone="red" /> : <Tag text="On track" tone="green" />;
  };
  const W = [2.2, 1, 1, 1, 1, 1.4, 0.8];
  const cell = (i: number) => ({ flex: W[i], paddingRight: 8, justifyContent: 'center' as const });

  return (
    <Screen title="Reports">
      <Muted>Last 6 weeks. Attendance counts a shift as attended when the DSP clocked in.</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Active DSPs" value={staff.length} /></View>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Avg. attendance rate" value={show(avg(rows.map((r) => r.attendance)))} /></View>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Avg. on-time clock-in" value={show(avg(weeks))} /></View>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Avg. eBinder completion" value={show(avg(rows.map((r) => r.ebinder)))} /></View>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Avg. training completion" value={show(avg(rows.map((r) => r.training)))} /></View>
        <View style={{ minWidth: 180, flexGrow: 1 }}><StatTile label="Credentials current" value={show(avg(rows.map((r) => r.credentials)))} /></View>
      </View>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ padding: 12 }}><Text style={s.h2}>All DSPs — report summary</Text><Muted>Select a DSP to see their full profile</Muted></View>
        <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
          {['DSP', 'Attendance', 'eBinder', 'Training', 'Credentials', 'Overall', ''].map((h, i) => <View key={i} style={cell(i)}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{h}</Text></View>)}
        </View>
        {rows.map(({ u, attendance, credentials, ebinder, training }) => (
          <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
            <View style={[cell(0), { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{initials(u.name)}</Text></View>
              <Text style={{ fontWeight: '600', color: colors.ink }}>{u.name}</Text>
            </View>
            <View style={cell(1)}><Text>{show(attendance)}</Text></View>
            <View style={cell(2)}><Text>{show(ebinder)}</Text></View>
            <View style={cell(3)}><Text>{show(training)}</Text></View>
            <View style={cell(4)}><Text>{show(credentials)}</Text></View>
            <View style={cell(5)}>{status(attendance, credentials, ebinder, training)}</View>
            <View style={cell(6)}><Pressable onPress={() => router.push({ pathname: '/admin/staff-detail', params: { id: u.id } } as never)}><Text style={{ color: colors.primary, fontWeight: '600' }}>View</Text></Pressable></View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.h2}>eBinder completion by folder</Text>
        {template.map((f) => {
          const inFolder = docs.filter((d) => d.folder === f);
          const parts = staff.flatMap((u) => signingStatus(inFolder, sigs, u.id));
          const v = pct(parts.filter((x) => x.signed).length, parts.length);
          return (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <Text style={{ width: 150, color: colors.ink }}>{f}</Text>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.tint }}><View style={{ width: `${v ?? 0}%` as never, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /></View>
              <Text style={{ width: 48, textAlign: 'right', color: colors.inkSoft }}>{show(v)}</Text>
            </View>
          );
        })}
        <Muted>Counts documents that need a signature. Folders with none show a dash.</Muted>
      </Card>

      <Card>
        <Text style={s.h2}>On-time clock-in rate</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120 }}>
          {weeks.map((v, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
              <Text style={{ fontSize: 11, color: colors.inkSoft }}>{show(v)}</Text>
              <View style={{ width: '100%', height: `${Math.max(v ?? 0, 2)}%` as never, backgroundColor: colors.primary, borderRadius: 4 }} />
              <Text style={{ fontSize: 11, color: colors.inkFaint }}>Wk {i + 1}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ padding: 12 }}><Text style={s.h2}>DSP utilization this week</Text><Muted>Worked hours against scheduled hours, for shifts already finished.</Muted></View>
        <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
          {['DSP', 'Scheduled hrs', 'Worked hrs', 'Utilization'].map((h, i) => <View key={i} style={cell(i === 3 ? 3 : i)}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{h}</Text></View>)}
        </View>
        {util.map(({ u, sh, wh, pct: p }) => (
          <View key={u.id} style={{ flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
            <View style={cell(0)}><Text style={{ fontWeight: '600', color: colors.ink }}>{u.name}</Text></View>
            <View style={cell(1)}><Text>{sh.toFixed(1)}</Text></View>
            <View style={cell(2)}><Text>{wh.toFixed(1)}</Text></View>
            <View style={cell(3)}><Text>{show(p)}</Text></View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
