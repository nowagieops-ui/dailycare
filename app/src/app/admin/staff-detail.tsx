import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useShiftsBetween, useStaff } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { useCredentials, stageOf, stageTone } from '../../lib/credentials';
import { daysLeft, stageLabel } from '../../lib/expiry';
import { db, functions } from '../../lib/firebase';
import { ensureDspFolder, moveFolder, useAllFolders } from '../../lib/drive';
import type { DriveItem } from '../../lib/types';
import { colors } from '../../lib/theme';
import { Btn, Card, Field, fmtDay, fmtTime, initials, Muted, Pill, s, Screen, Tag } from '../../lib/ui';
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
  const isSuper = profile?.role === 'super_admin';
  const { items: allFolders } = useAllFolders(isSuper);
  const [fq, setFq] = useState('');
  const [fmsg, setFmsg] = useState('');
  const pathName = (f: DriveItem) => [...f.path.map((p) => allFolders.find((x) => x.id === p)?.name ?? ''), f.name].filter(Boolean).join(' / ');
  const current = allFolders.find((f) => f.id === user?.recordsFolderId);
  const choices = allFolders.filter((f) => !f.clientId && !f.dspId).map((f) => ({ f, label: pathName(f) }))
    .filter((x) => x.label.toLowerCase().includes(fq.trim().toLowerCase())).sort((a, b) => a.label.localeCompare(b.label)).slice(0, 12);
  /** Moves the DSP's records folder to the sibling "Active" / "Inactive" folder when their status changes. */
  async function followStatus(nowActive: boolean) {
    if (!isSuper || !current) return '';
    const want = nowActive ? 'active' : 'inactive';
    const named = allFolders.filter((f) => f.name.trim().toLowerCase() === want && !f.dspId && f.id !== current.id);
    const dest = named.find((f) => f.parentId === (allFolders.find((x) => x.id === current.parentId)?.parentId ?? null)) ?? named[0];
    if (!dest) return ` No "${nowActive ? 'Active' : 'Inactive'}" folder was found, so their records folder stayed where it is.`;
    if (current.parentId === dest.id) return '';
    await moveFolder(current, dest);
    return ` Their records folder moved to "${pathName(dest)}".`;
  }
  async function fileHere(parent: DriveItem | null) {
    if (!user || !profile) return;
    setFmsg('Saving…');
    try {
      const made = await ensureDspFolder({ id: user.id, name: user.name }, parent, profile.uid, profile.name);
      await updateDoc(doc(db, 'users', user.id), { recordsFolderId: made.id });
      setFmsg(`${user.name}'s records folder is "${pathName(made)}".`);
    } catch { setFmsg('Could not set the folder. Try again.'); }
  }

  if (!user) return <Screen title="DSP"><Muted>Loading…</Muted></Screen>;
  async function doDelete() {
    setBusy(true);
    try {
      await httpsCallable(functions, 'deleteAccount')({ uid: user!.id });
      router.replace('/admin/staff' as never);
    } catch (e) {
      const m = (e as { message?: string }).message || 'Could not delete this account.';
      if (Platform.OS === 'web') window.alert(m); else Alert.alert('Not deleted', m);
    } finally { setBusy(false); }
  }
  function askDelete() {
    const text = `Permanently delete ${user!.name}? Their login and profile are removed and this cannot be undone. Past shifts and signed documents stay on record with their name; upcoming shifts become open.`;
    if (Platform.OS === 'web') { if (window.confirm(text)) doDelete(); }
    else Alert.alert('Delete account', text, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: doDelete }]);
  }
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
    <Screen title="DSP">
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
              onPress={async () => {
                setBusy(true);
                try {
                  await updateDoc(doc(db, 'users', user.id), { active: !user.active });
                  const note = await followStatus(!user.active).catch(() => ' Their records folder could not be moved.');
                  if (note) setFmsg(note.trim());
                } finally { setBusy(false); }
              }} />
          </View>
        )}
        {profile?.role === 'super_admin' && user.id !== profile.uid && (
          <View style={{ width: 150 }}><Btn label="Delete" tone="danger" busy={busy} onPress={askDelete} /></View>
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
          {isSuper && (
            <Card>
              <Text style={s.h2}>File manager folder</Text>
              <Muted>Choose where this DSP's records are filed (for example your Active, Inactive or Pending DSP folders). A folder with their name is created inside the one you pick.</Muted>
              <Text style={{ color: colors.ink }}>Current: {current ? pathName(current) : 'not set'}</Text>
              <Field label="Find a folder" value={fq} onChangeText={setFq} />
              {choices.length === 0 && <Muted>No folders match. Create them in the File manager first.</Muted>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {choices.map(({ f, label }) => (
                  <Pressable key={f.id} onPress={() => fileHere(f)} accessibilityRole="button"
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }}>
                    <Text style={{ color: colors.inkSoft, fontWeight: '600' }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {current && <Btn label="Open their folder" tone="ghost" onPress={() => router.push({ pathname: '/admin/files', params: { folder: current.id } } as never)} />}
              {fmsg ? <Muted>{fmsg}</Muted> : null}
            </Card>
          )}
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
