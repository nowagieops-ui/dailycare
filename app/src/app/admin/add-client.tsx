import { useState } from 'react';
import { Text, View } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { AddressPicker } from '../../components/AddressPicker';
import { DateField } from '../../components/DateTimeFields';
import { db } from '../../lib/firebase';
import { placesEnabled } from '../../lib/places';
import { SERVICE_LINES } from '../../lib/types';
import { Btn, Card, Chips, Field, InfoTip, Muted, s, Screen } from '../../lib/ui';

export default function AddClient() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('150');
  const [lines, setLines] = useState<string[]>([]);
  const [tasks, setTasks] = useState('');
  const [msg, setMsg] = useState('');

  const latN = Number(lat), lngN = Number(lng), radN = Number(radius);
  const valid =
    name.trim() && address.trim() && lines.length > 0 &&
    lat !== '' && lng !== '' && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180 && radN >= 50 && radN <= 2000;

  async function save() {
    await addDoc(collection(db, 'clients'), {
      name: name.trim(), address: address.trim(), lat: latN, lng: lngN, radiusM: radN, serviceLines: lines,
      ...(dob ? { dob } : {}), contactName: contactName.trim(), contactPhone: contactPhone.trim(),
      defaultTasks: tasks.split(/[;\n]/).map((t) => t.trim()).filter(Boolean),
    });
    setName(''); setDob(''); setContactName(''); setContactPhone(''); setAddress(''); setLat(''); setLng(''); setLines([]); setTasks(''); setMsg('Client added.');
  }

  return (
    <Screen title="New Client Intake">
      <Card>
        <Text style={s.h2}>Client information</Text>
        <Field label="Full name" value={name} onChangeText={setName} />
        <DateField label="Date of birth" value={dob} onChange={setDob} optional />
        <Field label="Primary contact / guardian" value={contactName} onChangeText={setContactName} />
        <Field label="Contact phone" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
        {placesEnabled ? (
          <AddressPicker label="Address" value={address} confirmed={lat !== '' && lng !== ''}
            onText={(t) => { setAddress(t); setLat(''); setLng(''); }}
            onPick={(p) => { setAddress(p.address); setLat(String(p.lat)); setLng(String(p.lng)); }} />
        ) : (
          <>
            <Field label="Address" value={address} onChangeText={setAddress} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '600' }}>Client's map location</Text>
              <InfoTip text="Address search is not switched on yet, so enter the location by hand. Search the address in Google Maps, right-click the pin, and click the numbers at the top of the menu to copy them. Paste the first number into Latitude and the second into Longitude." />
            </View>
            <Field label="Latitude" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" />
            <Field label="Longitude" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" />
          </>
        )}
        <Field label="Allowed radius in metres (50–2000)" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
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
