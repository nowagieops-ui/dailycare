import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useOpenAlerts, useShiftsBetween } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { useCredentials, useMissedRequests } from '../../lib/credentials';
import { daysLeft } from '../../lib/expiry';
import { markAllRead, timeAgo, useNotices } from '../../lib/notifications';
import { colors } from '../../lib/theme';
import { Btn, Card, Muted, s, Screen, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';

export default function AdminNotifications() {
  const { profile } = useAuth();
  const inbox = useNotices(profile?.uid);
  const alerts = useOpenAlerts();
  const pending = useMissedRequests({ pendingOnly: true });
  const creds = useCredentials().filter((c) => daysLeft(c.expiresOn.toMillis()) <= 30);
  const today = startOfDay(new Date());
  const open = useShiftsBetween(today, addDays(today, 14)).filter((x) => !x.staffId);

  const items: { key: string; mark: string; tone: 'amber' | 'red' | 'blue'; text: string; href: string; cta: string }[] = [
    ...alerts.map((a) => ({ key: a.id, mark: '!', tone: 'red' as const, text: `${a.staffName || 'Staff'} left ${a.clientName}`, href: '/admin', cta: 'Review' })),
    ...pending.map((m) => ({ key: m.id, mark: '!', tone: 'amber' as const, text: `${m.staffName} reported a missed clock-in for ${m.clientName}`, href: '/admin/requests', cta: 'Review' })),
    ...creds.map((c) => ({ key: c.id, mark: '!', tone: 'amber' as const, text: `${c.staffName}'s ${c.title} ${daysLeft(c.expiresOn.toMillis()) < 0 ? 'has expired' : `expires in ${daysLeft(c.expiresOn.toMillis())} days`}`, href: '/admin/training', cta: 'View' })),
    ...open.map((x) => ({ key: x.id, mark: '＋', tone: 'blue' as const, text: `Open shift needs coverage — ${x.start.toDate().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${x.clientName}`, href: '/admin/scheduling', cta: 'Assign' })),
  ];

  return (
    <Screen title="Notifications">
      <Card>
        <Text style={s.h2}>Needs attention</Text>
        {items.length === 0 && <Muted>All clear.</Muted>}
        {items.map((n, i) => (
          <View key={n.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <Tag text={n.mark} tone={n.tone} />
            <Text style={{ flex: 1, color: colors.ink, fontSize: 14 }}>{n.text}</Text>
            <Pressable onPress={() => router.push(n.href as never)}><Text style={{ color: colors.primary, fontWeight: '700' }}>{n.cta}</Text></Pressable>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={s.h2}>Inbox</Text>
        {inbox.length === 0 && <Muted>No messages yet.</Muted>}
        {inbox.map((n) => (
          <View key={n.id} style={{ paddingVertical: 6 }}>
            <Text style={{ fontWeight: n.read ? '500' : '800', color: colors.ink }}>{n.title}</Text>
            <Muted>{n.body} · {timeAgo(n.createdAt.toMillis())}</Muted>
          </View>
        ))}
        {inbox.some((n) => !n.read) && <Btn label="Mark all read" tone="ghost" onPress={() => markAllRead(inbox)} />}
      </Card>
    </Screen>
  );
}
