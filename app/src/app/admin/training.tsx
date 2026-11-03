import { useState } from 'react';
import { Text, View } from 'react-native';
import { addDoc, collection, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { DateField, TimeField } from '../../components/DateTimeFields';
import { useStaff } from '../../lib/admin-data';
import { hasTraining, stageOf, stageTone, useCredentials, useRequiredTrainings } from '../../lib/credentials';
import { daysLeft, stageLabel } from '../../lib/expiry';
import { db } from '../../lib/firebase';
import { parseLocalDate } from '../../lib/recurrence';
import { colors } from '../../lib/theme';
import { BANDS, type CredentialKind, type TrainingBand } from '../../lib/types';
import { Btn, Card, Chips, Field, fmtDay, Muted, Pill, s, Screen, StatTile, Tag } from '../../lib/ui';

export default function AdminTraining() {
  const staff = useStaff().filter((u) => (u.role === 'staff' || u.role === 'family_staff') && u.active);
  const rows = useCredentials();
  const required = useRequiredTrainings();

  const [who, setWho] = useState<string[]>([]);
  const [kind, setKind] = useState<CredentialKind>('training');
  const [band, setBand] = useState<TrainingBand[]>([]);
  const [title, setTitle] = useState('');
  const [exp, setExp] = useState('');
  const [reqTitle, setReqTitle] = useState('');
  const [reqBand, setReqBand] = useState<TrainingBand[]>(['Agency Specific']);
  const person = staff.find((u) => u.id === who[0]);
  const expDate = parseLocalDate(exp);

  async function add() {
    if (!person || !expDate) return;
    await addDoc(collection(db, 'credentials'), {
      staffId: person.id, staffName: person.name, title: title.trim(), kind,
      ...(band[0] ? { band: band[0] } : {}), expiresOn: Timestamp.fromDate(expDate),
    });
    setTitle(''); setExp('');
  }
  async function addRequired() {
    await addDoc(collection(db, 'trainings'), { title: reqTitle.trim(), band: reqBand[0] });
    setReqTitle('');
  }

  const total = staff.length * required.length;
  const done = staff.reduce((n, u) => n + required.filter((t) => hasTraining(rows, u.id, t)).length, 0);
  const overdue = staff.filter((u) => required.some((t) => !hasTraining(rows, u.id, t)) || rows.some((c) => c.staffId === u.id && daysLeft(c.expiresOn.toMillis()) < 0)).length;
  const soon = rows.filter((c) => { const d = daysLeft(c.expiresOn.toMillis()); return d >= 0 && d <= 30; }).length;
  const W = [2, 1, 1, 1.2, 0.8];

  return (
    <Screen title="Training & Credentials">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ minWidth: 200, flexGrow: 1 }}><StatTile label="Agency-wide completion" value={total ? `${Math.round((done / total) * 100)}%` : '—'} /></View>
        <View style={{ minWidth: 200, flexGrow: 1 }}><StatTile label="Staff with overdue training" value={overdue} /></View>
        <View style={{ minWidth: 200, flexGrow: 1 }}><StatTile label="Credentials expiring in 30 days" value={soon} /></View>
      </View>

      <Card>
        <Text style={s.h2}>Agency-wide required training</Text>
        <Muted>Every active staff member must hold a current credential with the same name. Add it for a person below to mark it complete.</Muted>
        {required.map((t) => {
          const n = staff.filter((u) => hasTraining(rows, u.id, t)).length;
          return (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '600', color: colors.ink }}>{t.title}</Text><Muted>{t.band} · {n} of {staff.length} complete</Muted></View>
              <Btn label="Remove" tone="ghost" onPress={() => deleteDoc(doc(db, 'trainings', t.id))} />
            </View>
          );
        })}
        <Field label="New required training" value={reqTitle} onChangeText={setReqTitle} />
        <Chips<TrainingBand> options={BANDS.map((b) => ({ value: b, label: b }))} selected={reqBand} onToggle={(v) => setReqBand([v])} />
        <Btn label="Add required training" onPress={addRequired} disabled={!reqTitle.trim() || !reqBand[0]} />
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ padding: 12 }}><Text style={s.h2}>Staff completion by training band</Text><Muted>Bands: Competency · MD DDA (state-mandated) · Agency Specific</Muted></View>
        <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
          {['Staff', ...BANDS, 'Overall'].map((h, i) => <View key={h} style={{ flex: W[i], paddingRight: 8 }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{h}</Text></View>)}
        </View>
        {staff.map((u) => {
          const per = BANDS.map((b) => { const r = required.filter((t) => t.band === b); return [r.filter((t) => hasTraining(rows, u.id, t)).length, r.length] as const; });
          const d = per.reduce((n, [a]) => n + a, 0), t = per.reduce((n, [, b]) => n + b, 0);
          return (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
              <View style={{ flex: W[0], paddingRight: 8 }}><Text style={{ fontWeight: '600', color: colors.ink }}>{u.name}</Text></View>
              {per.map(([a, b], i) => <View key={i} style={{ flex: W[i + 1], paddingRight: 8 }}><Text>{b ? `${a}/${b}` : '—'}</Text></View>)}
              <View style={{ flex: W[4] }}><Text style={{ fontWeight: '700' }}>{t ? `${Math.round((d / t) * 100)}%` : '—'}</Text></View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={s.h2}>Add or renew a credential</Text>
        <Chips options={staff.map((u) => ({ value: u.id, label: u.name }))} selected={who} onToggle={(v) => setWho([v])} />
        <Chips<CredentialKind>
          options={[{ value: 'training', label: 'Training' }, { value: 'certification', label: 'Certification' }, { value: 'document', label: 'Document' }]}
          selected={[kind]} onToggle={setKind}
        />
        <Muted>Band (optional)</Muted>
        <Chips<TrainingBand> options={BANDS.map((b) => ({ value: b, label: b }))} selected={band} onToggle={(v) => setBand((c) => (c[0] === v ? [] : [v]))} />
        <Field label="Name (e.g. CPR, COVID-19 Infection Control)" value={title} onChangeText={setTitle} />
        <DateField label="Expires on" value={exp} onChange={setExp} />
        <Btn label="Save" onPress={add} disabled={!person || !title.trim() || !expDate} />
        <Muted>Staff and admins are reminded at 3 months, 2 months, 1 month and 1 week, then daily until the date, then weekly if it lapses.</Muted>
      </Card>

      <Card>
        <Text style={s.h2}>All credentials</Text>
        {rows.map((c) => {
          const d = daysLeft(c.expiresOn.toMillis());
          const st = stageOf(d);
          return (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ fontWeight: '600', color: colors.ink }}>{c.title}</Text>
                <Muted>{c.staffName} · {fmtDay(c.expiresOn.toMillis())} · {d < 0 ? `${-d} days overdue` : `${d} days left`}</Muted>
              </View>
              {c.band && <Tag text={c.band} />}
              <Pill text={stageLabel[st]} tone={stageTone(st)} />
              <View style={{ width: 110 }}><Btn label="Remove" tone="ghost" onPress={() => deleteDoc(doc(db, 'credentials', c.id))} /></View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
