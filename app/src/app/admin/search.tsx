import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useClients, useStaff } from '../../lib/admin-data';
import { colors } from '../../lib/theme';
import { Card, Muted, s, Screen } from '../../lib/ui';

export default function Search() {
  const { q = '' } = useLocalSearchParams<{ q?: string }>();
  const needle = String(q).toLowerCase();
  const staff = useStaff().filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle));
  const clients = useClients().filter((c) => c.name.toLowerCase().includes(needle));
  const row = (key: string, label: string, sub: string, href: string) => (
    <Pressable key={key} onPress={() => router.push(href as never)} style={{ paddingVertical: 8 }}>
      <Text style={{ color: colors.ink, fontWeight: '600' }}>{label}</Text><Muted>{sub}</Muted>
    </Pressable>
  );
  return (
    <Screen title="Search">
      <Card><Text style={s.h2}>Staff ({staff.length})</Text>{staff.map((u) => row(u.id, u.name, u.email, '/admin/staff-detail?id=' + u.id))}</Card>
      <Card><Text style={s.h2}>Clients ({clients.length})</Text>{clients.map((c) => row(c.id, c.name, c.serviceLines.join(', '), '/admin/clients'))}</Card>
    </Screen>
  );
}
