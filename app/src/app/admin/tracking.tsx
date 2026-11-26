import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { collection, onSnapshot, query, Timestamp, where, type Timestamp as Ts } from 'firebase/firestore';
import { useShiftsBetween } from '../../lib/admin-data';
import { db } from '../../lib/firebase';
import { distanceM, mToFeet } from '../../lib/geo';
import { colors } from '../../lib/theme';
import { Card, fmtTime, Muted, s, Screen, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';

interface Point { id: string; shiftId: string; lat: number; lng: number; acc: number; at: Ts }

/** Where DSPs have been during their shifts today: last known position, distance from the client's address, and the trail. */
export default function Tracking() {
  const today = startOfDay(new Date());
  const shifts = useShiftsBetween(addDays(today, -1), addDays(today, 1)).filter((x) => x.status === 'clocked_in' || (x.clockInAt && x.clockInAt.toMillis() > Date.now() - 24 * 3600000));
  const [pts, setPts] = useState<Point[]>([]);
  const [open, setOpen] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'shiftTrack'), where('at', '>=', Timestamp.fromMillis(Date.now() - 36 * 3600000))),
    (snap) => setPts(snap.docs.map((d) => ({ ...(d.data() as Point), id: d.id }))), () => {}), []);

  return (
    <Screen title="Shift locations">
      <Muted>Locations are recorded about every 5 minutes while a DSP is clocked in, and stop when they clock out. Distances are measured from the client's address.</Muted>
      {shifts.length === 0 && <Card><Muted>No one is clocked in right now.</Muted></Card>}
      {shifts.map((sh) => {
        const mine = pts.filter((p) => p.shiftId === sh.id).sort((a, b) => b.at.toMillis() - a.at.toMillis());
        const last = mine[0];
        const dist = last ? distanceM(last.lat, last.lng, sh.lat, sh.lng) : null;
        const outside = dist !== null && dist > Math.max(sh.radiusM, 30) + Math.min(last.acc, 30);
        const outCount = mine.filter((p) => distanceM(p.lat, p.lng, sh.lat, sh.lng) > Math.max(sh.radiusM, 30) + Math.min(p.acc, 30)).length;
        return (
          <Card key={sh.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: colors.ink, flex: 1, minWidth: 180 }}>{sh.staffName || 'DSP'} · {sh.clientName}</Text>
              <Tag text={sh.status === 'clocked_in' ? 'Clocked in' : 'Finished'} tone={sh.status === 'clocked_in' ? 'green' : 'neutral'} />
              {last && <Tag text={outside ? 'Away from site' : 'At site'} tone={outside ? 'red' : 'green'} />}
            </View>
            <Muted>
              {last ? `Last seen ${fmtTime(last.at.toMillis())}, ${mToFeet(dist ?? 0)} ft from the address · ${mine.length} point${mine.length === 1 ? '' : 's'}${outCount ? ` · ${outCount} away from the site` : ''}` : 'No location points yet.'}
            </Muted>
            {mine.length > 0 && (
              <Pressable onPress={() => setOpen(open === sh.id ? '' : sh.id)} accessibilityRole="button"><Text style={{ color: colors.primary, fontWeight: '700' }}>{open === sh.id ? 'Hide trail' : 'Show trail'}</Text></Pressable>
            )}
            {open === sh.id && mine.map((p) => {
              const d = distanceM(p.lat, p.lng, sh.lat, sh.lng);
              return (
                <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.line }}>
                  <Text style={{ color: colors.ink }}>{fmtTime(p.at.toMillis())}</Text>
                  <Text style={{ color: colors.inkSoft, flex: 1 }}>{mToFeet(d)} ft from the address</Text>
                  <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps?q=${p.lat},${p.lng}`)}><Text style={{ color: colors.primary, fontWeight: '600' }}>Map</Text></Pressable>
                </View>
              );
            })}
          </Card>
        );
      })}
    </Screen>
  );
}
