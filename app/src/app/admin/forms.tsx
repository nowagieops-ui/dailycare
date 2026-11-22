import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTemplates } from '../../lib/forms';
import { colors } from '../../lib/theme';
import { Btn, Card, Muted, s, Screen, Tag } from '../../lib/ui';

export default function Forms() {
  const templates = useTemplates();
  return (
    <Screen title="PDF Forms">
      <Muted>Upload a PDF your DSPs fill in. The app turns it into a form, and DSP answers are written back into a finished PDF.</Muted>
      <View style={{ alignSelf: 'flex-start', width: 200 }}><Btn label="+ Add form from PDF" onPress={() => router.push('/admin/form-edit' as never)} /></View>
      {templates.length === 0 && <Muted>No forms yet.</Muted>}
      {templates.map((t) => (
        <Card key={t.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Pressable style={{ flex: 1, minWidth: 200 }} onPress={() => router.push({ pathname: '/admin/form-edit', params: { id: t.id } } as never)}>
              <Text style={s.h2}>{t.title}</Text>
              <Muted>{t.fields.length} fields · {t.serviceLines.length || t.clientIds.length ? [...t.serviceLines, ...(t.clientIds.length ? [`${t.clientIds.length} client(s)`] : [])].join(', ') : 'Every visit'}</Muted>
            </Pressable>
            {t.required && <Tag text="Required at clock-out" tone="amber" />}
            <Tag text={t.active ? 'Active' : 'Off'} tone={t.active ? 'green' : 'neutral'} />
            <Pressable onPress={() => updateDoc(doc(db, 'formTemplates', t.id), { active: !t.active })}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t.active ? 'Turn off' : 'Turn on'}</Text></Pressable>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
