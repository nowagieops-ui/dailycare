import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { colors } from '../../lib/theme';
import { Card, fmtDay, fmtTime, Muted, s, Screen } from '../../lib/ui';

interface Entry { id: string; at: Timestamp; event: string; text: string }

export default function AuditLog() {
  const [rows, setRows] = useState<Entry[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'auditLog'), orderBy('at', 'desc'), limit(200)),
    (snap) => setRows(snap.docs.map((d) => ({ ...(d.data() as Entry), id: d.id }))), () => {}), []);
  return (
    <Screen title="Audit log">
      <Muted>Recorded by the server, so entries cannot be edited from the app. They show what happened and to whom, not which admin did it.</Muted>
      <Card>
        <Text style={s.h2}>Latest 200 events</Text>
        {rows.length === 0 && <Muted>No events recorded yet.</Muted>}
        {rows.map((r, i) => (
          <View key={r.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <Text style={{ width: 150, fontSize: 12, color: colors.inkFaint }}>{fmtDay(r.at.toMillis())} {fmtTime(r.at.toMillis())}</Text>
            <Text style={{ flex: 1, color: colors.ink, fontSize: 14 }}>{r.text}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
