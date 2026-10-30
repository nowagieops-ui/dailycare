import { useState } from 'react';
import { Text } from 'react-native';
import { addDoc, collection, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useStaff } from '../../lib/admin-data';
import { stageOf, stageTone, useCredentials } from '../../lib/credentials';
import { daysLeft, stageLabel } from '../../lib/expiry';
import { db } from '../../lib/firebase';
import { parseLocalDate } from '../../lib/recurrence';
import type { CredentialKind } from '../../lib/types';
import { Btn, Card, Chips, Field, fmtDay, Muted, Pill, s, Screen } from '../../lib/ui';

export default function AdminTraining() {
  const staff = useStaff().filter((u) => u.role === 'staff' || u.role === 'family_staff');
  const rows = useCredentials();
  const [who, setWho] = useState<string[]>([]);
  const [kind, setKind] = useState<CredentialKind>('training');
  const [title, setTitle] = useState('');
  const [exp, setExp] = useState('');
  const person = staff.find((u) => u.id === who[0]);
  const expDate = parseLocalDate(exp);

  async function add() {
    if (!person || !expDate) return;
    await addDoc(collection(db, 'credentials'), {
      staffId: person.id, staffName: person.name, title: title.trim(), kind,
      expiresOn: Timestamp.fromDate(expDate),
    });
    setTitle(''); setExp('');
  }

  return (
    <Screen title="Trainings & certifications">
      <Card>
        <Text style={s.h2}>Add or renew</Text>
        <Chips options={staff.map((u) => ({ value: u.id, label: u.name }))} selected={who} onToggle={(v) => setWho([v])} />
        <Chips<CredentialKind>
          options={[{ value: 'training', label: 'Training' }, { value: 'certification', label: 'Certification' }, { value: 'document', label: 'Document' }]}
          selected={[kind]} onToggle={setKind}
        />
        <Field label="Name (e.g. CPR, COVID-19 Infection Control)" value={title} onChangeText={setTitle} />
        <Field label="Expires on (YYYY-MM-DD)" value={exp} onChangeText={setExp} />
        <Btn label="Save" onPress={add} disabled={!person || !title.trim() || !expDate} />
        <Muted>Staff and admins are reminded at 3 months, 2 months, 1 month and 1 week, then daily until the date, then weekly if it lapses.</Muted>
      </Card>
      {rows.map((c) => {
        const d = daysLeft(c.expiresOn.toMillis());
        const st = stageOf(d);
        return (
          <Card key={c.id}>
            <Text style={s.h2}>{c.title}</Text>
            <Muted>{c.staffName} · {fmtDay(c.expiresOn.toMillis())} · {d < 0 ? `${-d} days overdue` : `${d} days left`}</Muted>
            <Pill text={stageLabel[st]} tone={stageTone(st)} />
            <Btn label="Remove" tone="ghost" onPress={() => deleteDoc(doc(db, 'credentials', c.id))} />
          </Card>
        );
      })}
    </Screen>
  );
}
