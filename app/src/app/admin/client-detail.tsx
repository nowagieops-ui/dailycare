import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { AddressPicker } from '../../components/AddressPicker';
import { DateField, TimeField } from '../../components/DateTimeFields';
import { useClients, useShiftsBetween } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { clientFolderId } from '../../lib/drive';
import { audienceLabel, useAdminDocs, useFolderTemplate } from '../../lib/ebinder';
import { db } from '../../lib/firebase';
import { feetToM, mToFeet } from '../../lib/geo';
import { colors } from '../../lib/theme';
import { Btn, Card, fmtDay, fmtTime, Field, initials, Muted, s, Screen, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';
import { reviewStatus } from './clients';

const TABS = ['ISP / Care Plan', 'eBinder', 'Visit History', 'Care Team'] as const;

export default function ClientDetail() {
  const template = useFolderTemplate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useClients().find((x) => x.id === id);
  const today = useMemo(() => startOfDay(new Date()), []);
  const shifts = useShiftsBetween(addDays(today, -90), addDays(today, 30)).filter((x) => x.clientId === id);
  const docs = useAdminDocs().filter((d) => d.clientId === id);
  const { profile } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('ISP / Care Plan');
  const [goals, setGoals] = useState('');
  const [last, setLast] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState('');
  const [eContact, setEContact] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eAddr, setEAddr] = useState('');
  const [eLoc, setELoc] = useState<{ lat: number; lng: number } | null>(null);
  const [eFeet, setEFeet] = useState('');

  useEffect(() => {
    if (c) { setGoals((c.goals ?? []).join('\n')); setLast(c.lastReviewed ?? ''); setNext(c.nextReview ?? ''); }
  }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    setEName(c!.name); setEContact(c!.contactName ?? ''); setEPhone(c!.contactPhone ?? '');
    setEAddr(c!.address); setELoc(null); setEFeet(String(mToFeet(c!.radiusM))); setEditing(true);
  }
  const addrChanged = !!c && eAddr.trim() !== c.address.trim();
  const feetN = Number(eFeet);
  const editOk = eName.trim() && eAddr.trim() && feetN >= 10 && feetN <= 1000 && (!addrChanged || eLoc !== null);
  async function saveEdit() {
    await updateDoc(doc(db, 'clients', c!.id), {
      name: eName.trim(), contactName: eContact.trim(), contactPhone: ePhone.trim(), address: eAddr.trim(), radiusM: feetToM(feetN),
      ...(eLoc ? { lat: eLoc.lat, lng: eLoc.lng } : {}),
    });
    setEditing(false); setMsg('Client details updated. Shifts already scheduled keep the address they were created with.');
  }

  if (!c) return <Screen title="Client"><Muted>Loading…</Muted></Screen>;
  const folders = [...template, ...[...new Set(docs.map((d) => d.folder))].filter((f) => !template.includes(f)).sort()];
  const st = reviewStatus(c.nextReview);
  const visits = shifts.filter((x) => x.status === 'completed').sort((a, b) => b.start.toMillis() - a.start.toMillis());
  const team = [...new Map(shifts.filter((x) => x.staffId).map((x) => [x.staffId, x.staffName || 'DSP'])).entries()];

  async function save() {
    await updateDoc(doc(db, 'clients', c!.id), {
      goals: goals.split('\n').map((g) => g.trim()).filter(Boolean), lastReviewed: last, nextReview: next,
    });
    setMsg('Saved.');
  }

  return (
    <Screen title="Client">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{initials(c.name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.h1}>{c.name}</Text>
          <Muted>{c.serviceLines.join(' · ')}</Muted>
          <Muted>{c.address}</Muted>
          {(c.contactName || c.dob) && <Muted>{c.dob ? `DOB ${c.dob}` : ''}{c.dob && c.contactName ? ' · ' : ''}{c.contactName ? `Contact: ${c.contactName}${c.contactPhone ? ` ${c.contactPhone}` : ''}` : ''}</Muted>}
        </View>
        <Tag text={st.text} tone={st.tone} />
        <View style={{ minWidth: 130 }}><Btn label={editing ? 'Cancel' : 'Edit details'} tone="ghost" onPress={() => (editing ? setEditing(false) : startEdit())} /></View>
      </Card>
      {editing && (
        <Card>
          <Text style={s.h2}>Edit client details</Text>
          <Field label="Full name" value={eName} onChangeText={setEName} />
          <Field label="Primary contact / guardian" value={eContact} onChangeText={setEContact} />
          <Field label="Contact phone" value={ePhone} onChangeText={setEPhone} keyboardType="phone-pad" />
          <AddressPicker label="Address" value={eAddr} confirmed={!addrChanged || eLoc !== null}
            onText={(t) => { setEAddr(t); setELoc(null); }} onPick={(p) => { setEAddr(p.address); setELoc({ lat: p.lat, lng: p.lng }); }} />
          <Field label="Allowed clock-in distance in feet (10–1000)" value={eFeet} onChangeText={setEFeet} keyboardType="number-pad" />
          <Btn label="Save changes" onPress={saveEdit} disabled={!editOk} />
        </Card>
      )}
      {msg && !editing ? <Muted>{msg}</Muted> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: tab === t ? colors.primary : 'transparent' }}>
            <Text style={{ fontWeight: '700', color: tab === t ? colors.primary : colors.inkSoft }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'ISP / Care Plan' && (
        <Card>
          <Text style={s.h2}>Support goals</Text>
          <Field label="One goal per line" value={goals} onChangeText={setGoals} multiline numberOfLines={5} style={[s.input, { minHeight: 110, paddingTop: 10 }]} />
          <DateField label="Last reviewed" value={last} onChange={setLast} optional />
          <DateField label="Next review" value={next} onChange={setNext} optional />
          <Btn label="Save care plan" onPress={save} />
          {msg ? <Muted>{msg}</Muted> : null}
        </Card>
      )}

      {tab === 'eBinder' && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Text style={s.h2}>{c.name}'s eBinder</Text>
                <Muted>Everything here is also in this client's folder in the file manager. A file added in either place shows up in both.</Muted>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ width: 170 }}><Btn label="Upload document" onPress={() => router.push({ pathname: '/admin/ebinder-new', params: { clientId: c.id } } as never)} /></View>
                {profile?.role === 'super_admin' && (
                  <View style={{ width: 170 }}><Btn label="Open in file manager" tone="ghost" onPress={() => router.push({ pathname: '/admin/files', params: { folder: clientFolderId(c.id) } } as never)} /></View>
                )}
              </View>
            </View>
          </Card>
          {folders.map((f) => {
            const inFolder = docs.filter((d) => d.folder === f);
            return (
              <Card key={f}>
                <Text style={s.h2}>📁 {f} <Text style={{ color: colors.inkFaint, fontWeight: '500' }}>({inFolder.length})</Text></Text>
                {inFolder.length === 0 && <Muted>Nothing in this folder yet.</Muted>}
                {inFolder.map((d) => (
                  <Pressable key={d.id} onPress={() => router.push({ pathname: '/admin/document-detail', params: { id: d.id } } as never)} style={{ paddingVertical: 6 }}>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>{d.title}</Text>
                    <Muted>v{d.version} · {audienceLabel[d.audience]}</Muted>
                  </Pressable>
                ))}
              </Card>
            );
          })}
        </>
      )}

      {tab === 'Visit History' && (
        <Card>
          <Text style={s.h2}>Completed visits (last 90 days)</Text>
          {visits.length === 0 && <Muted>No completed visits yet.</Muted>}
          {visits.map((x) => (
            <Text key={x.id} style={{ color: colors.ink, paddingVertical: 4 }}>{fmtDay(x.start.toMillis())} · {fmtTime(x.start.toMillis())}–{fmtTime(x.end.toMillis())} · {x.staffName}</Text>
          ))}
        </Card>
      )}

      {tab === 'Care Team' && (
        <Card>
          <Text style={s.h2}>Care team</Text>
          {team.length === 0 && <Muted>No DSPs scheduled for this client recently.</Muted>}
          {team.map(([sid, name]) => (
            <Pressable key={sid} onPress={() => router.push({ pathname: '/admin/staff-detail', params: { id: sid } } as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{initials(name)}</Text>
              </View>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{name}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
