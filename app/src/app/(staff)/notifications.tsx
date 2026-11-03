import { Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { markAllRead, timeAgo, useNotices } from '../../lib/notifications';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Btn, Card, Muted } from '../../lib/ui';

export default function Notifications() {
  const { profile } = useAuth();
  const items = useNotices(profile?.uid);
  return (
    <StaffScreen title="Notifications">
      {items.some((n) => !n.read) && <Btn label="Mark all read" tone="ghost" onPress={() => markAllRead(items)} />}
      {items.length === 0 && <Muted>You're all caught up.</Muted>}
      {items.map((n) => (
        <Card key={n.id} style={n.read ? undefined : { borderColor: colors.primary }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontWeight: n.read ? '500' : '700', flex: 1 }}>{n.title}</Text>
            <Text style={{ color: colors.inkFaint, fontSize: 12 }}>{timeAgo(n.createdAt.toMillis())}</Text>
          </View>
          <Muted>{n.body}</Muted>
        </Card>
      ))}
    </StaffScreen>
  );
}
