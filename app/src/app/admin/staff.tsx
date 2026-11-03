import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useShiftsBetween, useStaff } from '../../lib/admin-data';
import { useCredentials } from '../../lib/credentials';
import { daysLeft } from '../../lib/expiry';
import { colors } from '../../lib/theme';
import type { Role } from '../../lib/types';
import { Btn, Card, fmtDay, fmtTime, initials, Muted, Screen, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';

export const ROLE_LABEL: Record<Role, string> = {
  staff: 'DSP', family_staff: 'Family Staff', admin: 'Office Admin', super_admin: 'Super Admin',
};
const W = [2.2, 1.2, 1, 1.4, 1.6, 0.8];

export default function StaffDirectory() {
  const staff = useStaff();
  const creds = useCredentials();
  const recent = useShiftsBetween(addDays(startOfDay(new Date()), -30), addDays(startOfDay(new Date()), 1));

  const certs = (id: string) => {
    const mine = creds.filter((c) => c.staffId === id);
    if (!mine.length) return <Tag text="None on file" />;
    const bad = mine.filter((c) => daysLeft(c.expiresOn.toMillis()) <= 90).length;
    return bad ? <Tag text={`${bad} expiring`} tone="amber" /> : <Tag text="Up to date" tone="green" />;
  };
  const last = (id: string) => {
    const ms = Math.max(0, ...recent.filter((x) => x.staffId === id && x.clockInAt).map((x) => x.clockInAt!.toMillis()));
    return ms ? `${fmtDay(ms)}, ${fmtTime(ms)}` : '—';
  };
  const cell = (i: number) => ({ flex: W[i], paddingRight: 8, justifyContent: 'center' as const });
  const head = ['Name', 'Role', 'Status', 'Certifications', 'Last clock-in', ''];

  return (
    <Screen title="Staff Directory">
      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <View style={{ width: 200 }}><Btn label="Generate admin code" tone="ghost" onPress={() => router.push('/admin/add-staff' as never)} /></View>
        <View style={{ width: 160 }}><Btn label="+ Add Staff" onPress={() => router.push('/admin/add-staff' as never)} /></View>
      </View>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
          {head.map((h, i) => <View key={i} style={cell(i)}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{h}</Text></View>)}
        </View>
        {staff.length === 0 && <View style={{ padding: 12 }}><Muted>No staff yet.</Muted></View>}
        {staff.map((u) => (
          <Pressable key={u.id} onPress={() => router.push({ pathname: '/admin/staff-detail', params: { id: u.id } } as never)}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
            <View style={[cell(0), { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{initials(u.name)}</Text>
              </View>
              <Text numberOfLines={1} style={{ fontWeight: '600', color: colors.ink, flexShrink: 1 }}>{u.name}</Text>
            </View>
            <View style={cell(1)}><Text style={{ color: colors.ink }}>{ROLE_LABEL[u.role]}</Text></View>
            <View style={cell(2)}><Tag text={u.active ? 'Active' : 'Inactive'} tone={u.active ? 'green' : 'neutral'} /></View>
            <View style={cell(3)}>{certs(u.id)}</View>
            <View style={cell(4)}><Text style={{ color: colors.inkSoft, fontSize: 13 }}>{last(u.id)}</Text></View>
            <View style={cell(5)}><Text style={{ color: colors.primary, fontWeight: '600' }}>View</Text></View>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
