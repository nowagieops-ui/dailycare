import { useState } from 'react';
import { Text } from 'react-native';
import { addDoc, collection, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { useAnnouncements } from '../../lib/shifts';
import { Btn, Card, Field, fmtDay, Muted, s, Screen } from '../../lib/ui';

export default function Announcements() {
  const { profile } = useAuth();
  const items = useAnnouncements();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function post() {
    setBusy(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(), body: body.trim(), createdAt: Timestamp.now(), authorName: profile?.name ?? '',
      });
      setTitle(''); setBody('');
    } finally { setBusy(false); }
  }

  return (
    <Screen title="Announcements">
      <Card>
        <Text style={s.h2}>New announcement</Text>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field label="Message" value={body} onChangeText={setBody} multiline style={[s.input, { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }]} />
        <Btn label="Post to all DSPs" onPress={post} busy={busy} disabled={!title.trim() || !body.trim()} />
      </Card>
      {items.map((a) => (
        <Card key={a.id}>
          <Text style={{ fontWeight: '700' }}>{a.title}</Text>
          <Muted>{a.body}</Muted>
          <Muted>{fmtDay(a.createdAt.toMillis())} · {a.authorName}</Muted>
          <Btn label="Delete" tone="ghost" onPress={() => deleteDoc(doc(db, 'announcements', a.id))} />
        </Card>
      ))}
    </Screen>
  );
}
