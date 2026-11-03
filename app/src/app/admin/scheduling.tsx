import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useShiftsBetween, useStaff } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { colors } from '../../lib/theme';
import { canAdminister, SERVICE_LINES, type Shift } from '../../lib/types';
import { Btn, Card, Chips, fmtTime, Muted, Pill, s, Screen } from '../../lib/ui';
import { addDays, sameDay, startOfDay } from '../../lib/week';

const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const short = (ms: number) => fmtTime(ms).replace(':00', '').replace(' ', '');
const range = (x: Shift) => `${short(x.start.toMillis())}–${short(x.end.toMillis())}`;
const COL = 120;

export default function Scheduling() {
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [line, setLine] = useState<string[]>([]);
  const [sel, setSel] = useState<Shift | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = canAdminister(useAuth().profile?.role);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const all = useShiftsBetween(monday, addDays(monday, 7));
  const shifts = line.length ? all.filter((x) => x.serviceLine === line[0]) : all;
  const staff = useStaff().filter((u) => (u.role === 'staff' || u.role === 'family_staff') && u.active);
  const todayStart = startOfDay(new Date());

  const label = `Week of ${monday.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${addDays(monday, 6).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const cell = (staffId: string, d: Date) => shifts.filter((x) => x.staffId === staffId && sameDay(x.start.toDate(), d));

  const chip = (x: Shift) => {
    const open = !x.staffId;
    return (
      <Pressable key={x.id} onPress={() => setSel(x)} accessibilityRole="button"
        style={{ borderRadius: 8, padding: 6, backgroundColor: open ? colors.amberBg : colors.tint, borderWidth: sel?.id === x.id ? 2 : 0, borderColor: colors.primary }}>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: open ? colors.amber : colors.primary }}>{open ? 'Open' : x.clientName}</Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: colors.inkSoft }}>{open ? `${x.clientName} · ` : ''}{range(x)}</Text>
      </Pressable>
    );
  };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); setSel(null); } finally { setBusy(false); }
  }

  const row = (key: string, name: string, staffId: string) => (
    <View key={key} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ width: 130, padding: 10, justifyContent: 'center' }}><Text style={{ fontWeight: '600', color: colors.ink }}>{name}</Text></View>
      {days.map((d) => (
        <View key={d.toISOString()} style={{ width: COL, padding: 4, gap: 4, backgroundColor: sameDay(d, todayStart) ? '#F7F8FE' : undefined }}>
          {cell(staffId, d).map(chip)}
        </View>
      ))}
    </View>
  );

  return (
    <Screen title="Scheduling">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Chips options={SERVICE_LINES.map((l) => ({ value: l as string, label: l }))} selected={line} onToggle={(v) => setLine((c) => (c[0] === v ? [] : [v]))} />
        </View>
        {canEdit && <View style={{ width: 150 }}><Btn label="+ Add Shift" onPress={() => router.push('/admin/add-shift' as never)} /></View>}
      </View>
      <Muted>Tap a service line to filter; tap it again to show all.</Muted>

      <Card style={{ padding: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable accessibilityLabel="Previous week" onPress={() => setMonday(addDays(monday, -7))} style={{ padding: 6 }}><Text style={{ fontSize: 18, color: colors.primary }}>‹</Text></Pressable>
            <Text style={s.h2}>{label}</Text>
            <Pressable accessibilityLabel="Next week" onPress={() => setMonday(addDays(monday, 7))} style={{ padding: 6 }}><Text style={{ fontSize: 18, color: colors.primary }}>›</Text></Pressable>
            <Pressable onPress={() => setMonday(mondayOf(new Date()))}><Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>Today</Text></Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}><Pill text="● Scheduled" tone="blue" /><Pill text="● Open shift" tone="amber" /></View>
        </View>
        <ScrollView horizontal>
          <View>
            <View style={{ flexDirection: 'row', backgroundColor: colors.bg }}>
              <View style={{ width: 130, padding: 10 }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>Staff</Text></View>
              {days.map((d) => (
                <View key={d.toISOString()} style={{ width: COL, padding: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: sameDay(d, todayStart) ? colors.primary : colors.inkSoft }}>
                    {d.toLocaleDateString([], { weekday: 'short' })} {d.getDate()}
                  </Text>
                </View>
              ))}
            </View>
            {row('open', 'Open shifts', '')}
            {staff.map((u) => row(u.id, u.name, u.id))}
          </View>
        </ScrollView>
      </Card>

      {sel && (
        <Card>
          <Text style={s.h2}>{sel.clientName} · {sel.serviceLine}</Text>
          <Muted>{sel.start.toDate().toDateString()}, {range(sel)} · {sel.staffName || 'Open shift'}</Muted>
          {canEdit && !sel.staffId && (
            <>
              <Text style={{ fontWeight: '600' }}>Assign to</Text>
              <Chips options={staff.map((u) => ({ value: u.id, label: u.name }))} selected={[]}
                onToggle={(id) => { const u = staff.find((x) => x.id === id); if (u) run(() => updateDoc(doc(db, 'shifts', sel.id), { staffId: u.id, staffName: u.name, staffPhone: u.phone ?? '' })); }} />
            </>
          )}
          {canEdit && sel.status === 'scheduled' && <Btn label="Delete shift" tone="danger" busy={busy} onPress={() => run(() => deleteDoc(doc(db, 'shifts', sel.id)))} />}
          <Btn label="Close" tone="ghost" onPress={() => setSel(null)} />
        </Card>
      )}
    </Screen>
  );
}
