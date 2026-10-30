import { useState } from 'react';
import { Text } from 'react-native';
import * as Location from 'expo-location';
import { addDoc, collection } from 'firebase/firestore';
import { useClients } from '../../lib/admin-data';
import { db } from '../../lib/firebase';
import { SERVICE_LINES } from '../../lib/types';
import { Btn, Card, Chips, Field, Muted, Pill, s, Screen } from '../../lib/ui';

export default function Clients() {
  const clients = useClients();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('150');
  const [lines, setLines] = useState<string[]>([]);
  const [tasks, setTasks] = useState('');
  const [msg, setMsg] = useState('');

  async function useHere() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return setMsg('Location permission denied.');
    const p = await Location.getCurrentPositionAsync({});
    setLat(p.coords.latitude.toFixed(6));
    setLng(p.coords.longitude.toFixed(6));
  }

  const latN = Number(lat), lngN = Number(lng), radN = Number(radius);
  const valid =
    name.trim() && address.trim() && lines.length > 0 &&
    lat !== '' && lng !== '' && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180 && radN >= 50 && radN <= 2000;

  async function save() {
    await addDoc(collection(db, 'clients'), {
      name: name.trim(), address: address.trim(), lat: latN, lng: lngN, radiusM: radN, serviceLines: lines,
      defaultTasks: tasks.split(/[;\n]/).map((t) => t.trim()).filter(Boolean),
    });
    setName(''); setAddress(''); setLat(''); setLng(''); setLines([]); setTasks(''); setMsg('Client added.');
  }

  return (
    <Screen title="Clients">
      <Card>
        <Text style={s.h2}>Add client</Text>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Address" value={address} onChangeText={setAddress} />
        <Text style={{ fontWeight: '600' }}>Client's map location</Text>
        <Muted>
          This is the client's address on the map, used to check staff are on site. To get it: search the address in
          Google Maps, right-click the pin, and click the numbers at the top of the menu to copy them. Paste the first
          number into Latitude and the second into Longitude.
        </Muted>
        <Field label="Latitude" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" />
        <Field label="Longitude" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" />
        <Btn label="I'm at the client's address: fill in from my location" tone="ghost" onPress={useHere} />
        <Muted>Only use this button while standing at the client's address. It saves where you are right now, not where the client lives.</Muted>
        <Field label="Allowed radius in metres (50–2000)" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
        <Text style={{ fontWeight: '600' }}>Service lines (pick all that apply)</Text>
        <Chips
          options={SERVICE_LINES.map((l) => ({ value: l as string, label: l }))}
          selected={lines}
          onToggle={(v) => setLines((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
        />
        <Field label="Default visit tasks (separate with ;)" value={tasks} onChangeText={setTasks} />
        <Btn label="Save client" onPress={save} disabled={!valid} />
        {msg ? <Muted>{msg}</Muted> : null}
      </Card>
      {clients.map((c) => (
        <Card key={c.id}>
          <Text style={s.h2}>{c.name}</Text>
          <Muted>{c.address}</Muted>
          {c.serviceLines.map((l) => <Pill key={l} text={l} tone="blue" />)}
        </Card>
      ))}
    </Screen>
  );
}
