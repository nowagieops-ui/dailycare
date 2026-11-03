import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useAnnouncements } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Card, fmtDay, Muted, s } from '../../lib/ui';

export default function Announcements() {
  const rows = useAnnouncements();
  return (
    <StaffScreen title="Agency Announcements">
      <Pressable onPress={() => router.replace('/chat' as never)}><Text style={{ color: colors.primary, fontWeight: '700' }}>← Team Chat</Text></Pressable>
      {rows.length === 0 && <Muted>Nothing yet.</Muted>}
      {rows.map((a) => (
        <Card key={a.id}><Text style={s.h2}>{a.title}</Text><Text style={{ color: colors.ink }}>{a.body}</Text><Muted>{a.authorName} · {fmtDay(a.createdAt.toMillis())}</Muted></Card>
      ))}
    </StaffScreen>
  );
}
