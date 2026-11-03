import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useClients, useShiftsBetween } from '../../lib/admin-data';
import { audienceLabel, useAdminDocs } from '../../lib/ebinder';
import { db } from '../../lib/firebase';
import { colors } from '../../lib/theme';
import { Btn, Card, fmtDay, fmtTime, Field, initials, Muted, s, Screen, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';
import { reviewStatus } from './clients';

const TABS = ['ISP / Care Plan', 'eBinder', 'Visit History', 'Care Team'] as const;

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useClients().find((x) => x.id === id);
  const today = useMemo(() => startOfDay(new Date()), []);
  const shifts = useShiftsBetween(addDays(today, -90), addDays(today, 30)).filter((x) => x.clientId === id);
  const docs = useAdminDocs().filter((d) => d.clientId === id);
  const [tab, setTab] = useState<(typeof TABS)[number]>('ISP / Care Plan');
  const [goals, setGoals] = useState('');
  const [last, setLast] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (c) { setGoals((c.goals ?? []).join('\n')); setLast(c.lastReviewed ?? ''); setNext(c.nextReview ?? ''); }
  }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <Screen title="Client"><Muted>Loading…</Muted></Screen>;
  const st = reviewStatus(c.nextReview);
  const visits = shifts.filter((x) => x.status === 'completed').sort((a, b) => b.start.toMillis() - a.start.toMillis());
  const team = [...new Map(shifts.filter((x) => x.staffId).map((x) => [x.staffId, x.staffName || 'Staff'])).entries()];

  async function save() {
    await updateDoc(doc(db, 'clients', c!.id), {
      goals: goals.split('\n').map((g) => g.trim()).filter(Boolean), lastReviewed: last, nextReview: next,
    });
    setMsg('Saved.');
  }

  return (
    <Screen title="Client">
      <Pressable onPress={() => router.replace('/admin/clients' as never)}><Text style={{ color: colors.primary, fontWeight: '600' }}>← Back to Clients Directory</Text></Pressable>
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
      </Card>

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
          <Field label="Last reviewed (YYYY-MM-DD)" value={last} onChangeText={setLast} />
          <Field label="Next review (YYYY-MM-DD)" value={next} onChangeText={setNext} />
          <Btn label="Save care plan" onPress={save} />
          {msg ? <Muted>{msg}</Muted> : null}
        </Card>
      )}

      {tab === 'eBinder' && (
        <Card>
          <Text style={s.h2}>eBinder</Text>
          {docs.length === 0 && <Muted>No documents linked to this client yet. When you upload a Care Plan or Waiver document, pick this client.</Muted>}
          {docs.map((d) => (
            <Pressable key={d.id} onPress={() => router.push({ pathname: '/admin/document-detail', params: { id: d.id } } as never)} style={{ paddingVertical: 6 }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>{d.title}</Text>
              <Muted>{d.folder} · v{d.version} · {audienceLabel[d.audience]}</Muted>
            </Pressable>
          ))}
        </Card>
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
          {team.length === 0 && <Muted>No staff scheduled for this client recently.</Muted>}
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
