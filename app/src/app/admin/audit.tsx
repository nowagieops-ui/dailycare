import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore';
import { DateField } from '../../components/DateTimeFields';
import { useAuth } from '../../lib/auth';
import { AUDIT_LABELS, type AuditCategory } from '../../lib/audit';
import { db } from '../../lib/firebase';
import { colors } from '../../lib/theme';
import { Card, Chips, fmtDay, fmtTime, Muted, s, Screen, Tag } from '../../lib/ui';

interface Activity { id: string; at: Timestamp; category: AuditCategory; text: string; actorName: string; actorEmail: string }
interface Entry { id: string; at: Timestamp; event: string; text: string }

export default function AuditLog() {
  const { profile } = useAuth();
  const [acts, setActs] = useState<Activity[]>([]);
  const [sys, setSys] = useState<Entry[]>([]);
  const [cat, setCat] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [who, setWho] = useState<string[]>([]);
  const [tab, setTab] = useState<string[]>(['people']);
  const isSuper = profile?.role === 'super_admin';

  useEffect(() => {
    if (!isSuper) return;
    const a = onSnapshot(query(collection(db, 'activity'), orderBy('at', 'desc'), limit(1000)), (snap) => setActs(snap.docs.map((d) => ({ ...(d.data() as Activity), id: d.id }))), () => {});
    const b = onSnapshot(query(collection(db, 'auditLog'), orderBy('at', 'desc'), limit(200)), (snap) => setSys(snap.docs.map((d) => ({ ...(d.data() as Entry), id: d.id }))), () => {});
    return () => { a(); b(); };
  }, [isSuper]);

  const people = useMemo(() => [...new Set(acts.map((x) => x.actorName))].sort(), [acts]);
  const rows = acts.filter((r) => {
    if (!r.at) return false;
    const ms = r.at.toMillis();
    if (cat.length && !cat.includes(r.category)) return false;
    if (who.length && !who.includes(r.actorName)) return false;
    if (from && ms < new Date(from + 'T00:00:00').getTime()) return false;
    if (to && ms > new Date(to + 'T23:59:59').getTime()) return false;
    return true;
  });

  if (!isSuper) return <Screen title="Audit log"><Muted>Only a super admin can view the audit log.</Muted></Screen>;
  return (
    <Screen title="Audit log">
      <Muted>Every change records the person's name, their login email and the time. Entries are written by the system and cannot be edited. Use a separate login for each person so this stays accurate.</Muted>
      <Chips options={[{ value: 'people', label: 'Who did what' }, { value: 'system', label: 'System events' }]} selected={tab} onToggle={(v) => setTab([v])} />
      {tab[0] === 'people' ? (
        <>
          <Card>
            <Text style={s.h2}>Filter</Text>
            <Chips options={(Object.keys(AUDIT_LABELS) as AuditCategory[]).map((k) => ({ value: k as string, label: AUDIT_LABELS[k] }))} selected={cat}
              onToggle={(v) => setCat((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 160 }}><DateField label="From" value={from} onChange={setFrom} optional /></View>
              <View style={{ flex: 1, minWidth: 160 }}><DateField label="To" value={to} onChange={setTo} optional /></View>
            </View>
            {people.length > 0 && (
              <>
                <Text style={{ fontWeight: '600' }}>Person</Text>
                <Chips options={people.map((p) => ({ value: p, label: p }))} selected={who} onToggle={(v) => setWho((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
              </>
            )}
          </Card>
          <Card>
            <Text style={s.h2}>{rows.length} change{rows.length === 1 ? '' : 's'}</Text>
            {rows.length === 0 && <Muted>Nothing recorded for these filters yet.</Muted>}
            {rows.slice(0, 300).map((r, i) => (
              <View key={r.id} style={{ gap: 4, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <Tag text={AUDIT_LABELS[r.category] ?? r.category} tone="blue" />
                  <Text style={{ fontSize: 12, color: colors.inkFaint }}>{fmtDay(r.at.toMillis())} {fmtTime(r.at.toMillis())}</Text>
                </View>
                <Text style={{ color: colors.ink }}>{r.text}</Text>
                <Muted>{r.actorName} · {r.actorEmail}</Muted>
              </View>
            ))}
            {rows.length > 300 && <Muted>Showing the latest 300. Narrow the filters to see older entries.</Muted>}
          </Card>
        </>
      ) : (
        <Card>
          <Text style={s.h2}>Latest 200 system events</Text>
          {sys.length === 0 && <Muted>No events recorded yet.</Muted>}
          {sys.map((r, i) => (
            <View key={r.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <Text style={{ width: 150, fontSize: 12, color: colors.inkFaint }}>{fmtDay(r.at.toMillis())} {fmtTime(r.at.toMillis())}</Text>
              <Text style={{ flex: 1, color: colors.ink, fontSize: 14 }}>{r.text}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
