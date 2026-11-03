import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useShiftsBetween, useStaff } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { useCredentials, stageOf, stageTone } from '../../lib/credentials';
import { daysLeft, stageLabel } from '../../lib/expiry';
import { db } from '../../lib/firebase';
import { colors } from '../../lib/theme';
import { Btn, Card, fmtDay, fmtTime, initials, Muted, Pill, s, Screen, Tag } from '../../lib/ui';
import { addDays, hoursWorked, startOfDay } from '../../lib/week';
import { ROLE_LABEL } from './staff';

const TABS = ['Profile', 'Schedule', 'Documents', 'Attendance'] as const;

export default function StaffDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const user = useStaff().find((u) => u.id === id);
  const creds = useCredentials(id);
  const today = useMemo(() => startOfDay(new Date()), []);
  const shifts = useShiftsBetween(addDays(today, -30), addDays(today, 30)).filter((x) => x.staffId === id);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Profile');
  const [busy, setBusy] = useState(false);

  if (!user) return <Screen title="Staff"><Muted>Loading…</Muted></Screen>;
  const canEdit = profile?.role === 'super_admin' || (profile?.role === 'admin' && (user.role === 'staff' || user.role === 'family_staff'));
  const upcoming = shifts.filter((x) => x.start.toMillis() >= today.getTime()).sort((a, b) => a.start.toMillis() - b.start.toMillis());
  const past = shifts.filter((x) => x.start.toMillis() < today.getTime() + 86400000).sort((a, b) => b.start.toMillis() - a.start.toMillis());
  const clients = [...new Set(upcoming.map((x) => x.clientName))];
  const started = user.startDate ? new Date(user.startDate + 'T00:00:00').toLocaleDateString([], { month: 'short', year: 'numeric' }) : null;

  const row = (k: string, v: string) => (
    <View key={k} style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
      <Text style={{ width: 130, color: colors.inkSoft }}>{k}</Text><Text style={{ flex: 1, color: colors.ink }}>{v || '—'}</Text>
    </View>
  );

  return (
    <Screen title="Staff">
      <Pressable onPress={() => router.replace('/admin/staff' as never)}><Text style={{ color: colors.primary, fontWeight: '600' }}>← Back to Staff Directory</Text></Pressable>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{initials(user.name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.h1}>{user.name}</Text>
          <Muted>{ROLE_LABEL[user.role]}{started ? ` · Started ${started}` : ''}</Muted>
        </View>
        <Tag text={user.active ? 'Active' : 'Inactive'} tone={user.active ? 'green' : 'neutral'} />
        {canEdit && user.id !== profile?.uid && (
          <View style={{ width: 150 }}>
            <Btn label={user.active ? 'Deactivate' : 'Reactivate'} tone={user.active ? 'danger' : 'primary'} busy={busy}
              onPress={async () => { setBusy(true); try { await updateDoc(doc(db, 'users', user.id), { active: !user.active }); } finally { setBusy(false); } }} />
          </View>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: 4, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: tab === t ? colors.primary : 'transparent' }}>
            <Text style={{ fontWeight: '700', color: tab === t ? colors.primary : colors.inkSoft }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Profile' && (
        <>
          <Card>
            <Text style={s.h2}>Contact & role</Text>
            {row('Email', user.email)}{row('Phone', user.phone ?? '')}{row('Role', ROLE_LABEL[user.role])}
            {row('Assigned clients', clients.join(', '))}
          </Card>
          <Card>
            <Text style={s.h2}>Certifications</Text>
            {creds.length === 0 && <Muted>None on file. Add them from Training & Credentials.</Muted>}
            {creds.map((c) => {
              const d = daysLeft(c.expiresOn.toMillis());
              return (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 8 }}>
                  <Text style={{ flex: 1, color: colors.ink }}>{c.title}</Text>
                  <Muted>{c.expiresOn.toDate().toLocaleDateString()}</Muted>
                  <Pill text={d < 0 ? 'Expired' : stageLabel[stageOf(d)] === 'Valid' ? 'Valid' : 'Expiring'} tone={stageTone(stageOf(d))} />
                </View>
              );
            })}
          </Card>
        </>
      )}

      {tab === 'Schedule' && (
        <Card>
          <Text style={s.h2}>Upcoming shifts (next 30 days)</Text>
          {upcoming.length === 0 && <Muted>No upcoming shifts.</Muted>}
          {upcoming.map((x) => (
            <Text key={x.id} style={{ color: colors.ink, paddingVertical: 4 }}>{fmtDay(x.start.toMillis())} · {fmtTime(x.start.toMillis())}–{fmtTime(x.end.toMillis())} · {x.clientName} ({x.serviceLine})</Text>
          ))}
        </Card>
      )}

      {tab === 'Documents' && (
        <Card>
          <Text style={s.h2}>Documents</Text>
          {creds.filter((c) => c.kind === 'document').length === 0 && <Muted>No documents on file yet.</Muted>}
          {creds.filter((c) => c.kind === 'document').map((c) => <Text key={c.id} style={{ color: colors.ink, paddingVertical: 4 }}>{c.title} · expires {c.expiresOn.toDate().toLocaleDateString()}</Text>)}
        </Card>
      )}

      {tab === 'Attendance' && (
        <Card>
          <Text style={s.h2}>Last 30 days · {hoursWorked(past, addDays(today, -30), addDays(today, 1))} h worked</Text>
          {past.length === 0 && <Muted>No shifts yet.</Muted>}
          {past.map((x) => (
            <Text key={x.id} style={{ color: colors.ink, paddingVertical: 4 }}>
              {fmtDay(x.start.toMillis())} · {x.clientName} · {x.clockInAt ? `${fmtTime(x.clockInAt.toMillis())} – ${x.clockOutAt ? fmtTime(x.clockOutAt.toMillis()) : 'still on shift'}` : x.start.toMillis() < Date.now() ? 'No clock-in' : 'Scheduled'}
            </Text>
          ))}
        </Card>
      )}
    </Screen>
  );
}
