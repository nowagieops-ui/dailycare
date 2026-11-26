import { useState } from 'react';
import { Text } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { AddressPicker } from '../../components/AddressPicker';
import { DateField } from '../../components/DateTimeFields';
import { useAuth } from '../../lib/auth';
import { audit } from '../../lib/audit';
import { db } from '../../lib/firebase';
import { feetToM } from '../../lib/geo';
import { SERVICE_LINES } from '../../lib/types';
import { Btn, Card, Chips, Field, Muted, s, Screen } from '../../lib/ui';

export default function AddClient() {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  // The map point comes only from a picked address search result; it is never typed in.
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState('25');
  const [lines, setLines] = useState<string[]>([]);
  const [tasks, setTasks] = useState('');
  const [msg, setMsg] = useState('');

  const radN = Number(radius);
  const valid = name.trim() && address.trim() && lines.length > 0 && loc !== null && radN >= 10 && radN <= 1000;

  async function save() {
    if (!loc) return;
    await addDoc(collection(db, 'clients'), {
      name: name.trim(), address: address.trim(), lat: loc.lat, lng: loc.lng, radiusM: feetToM(radN), serviceLines: lines, status: 'potential',
      ...(dob ? { dob } : {}), contactName: contactName.trim(), contactPhone: contactPhone.trim(),
      defaultTasks: tasks.split(/[;\n]/).map((t) => t.trim()).filter(Boolean),
    });
    audit(profile, 'client', `Created client ${name.trim()} (Potential)`);
    setName(''); setDob(''); setContactName(''); setContactPhone(''); setAddress(''); setLoc(null); setLines([]); setTasks(''); setMsg('Client added.');
  }

  return (
    <Screen title="New Client Intake">
      <Card>
        <Text style={s.h2}>Client information</Text>
        <Field label="Full name" value={name} onChangeText={setName} />
        <DateField label="Date of birth" value={dob} onChange={setDob} optional />
        <Field label="Primary contact / guardian" value={contactName} onChangeText={setContactName} />
        <Field label="Contact phone" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
        <AddressPicker label="Address" value={address} confirmed={loc !== null}
          onText={(t) => { setAddress(t); setLoc(null); }}
          onPick={(p) => { setAddress(p.address); setLoc({ lat: p.lat, lng: p.lng }); }} />
        <Field label="Allowed clock-in distance in feet (10–1000, default 25)" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
        <Text style={{ fontWeight: '600' }}>Service lines (pick all that apply)</Text>
        <Chips
          options={SERVICE_LINES.map((l) => ({ value: l as string, label: l }))}
          selected={lines}
          onToggle={(v) => setLines((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
        />
        <Field label="Default visit tasks (separate with ;)" value={tasks} onChangeText={setTasks} />
        <Btn label="Create client record" onPress={save} disabled={!valid} />
        {msg ? <Muted>{msg}</Muted> : null}
      </Card>
    </Screen>
  );
}
