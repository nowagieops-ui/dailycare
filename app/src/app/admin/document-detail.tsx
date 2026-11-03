import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useStaff } from '../../lib/admin-data';
import { audienceLabel, renderBody, useAdminDocs, useDocEvents, useSignatures } from '../../lib/ebinder';
import { colors } from '../../lib/theme';
import { Btn, Card, fmtDay, fmtTime, initials, Muted, s, Screen, Tag } from '../../lib/ui';

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useAdminDocs().find((x) => x.id === id);
  const staff = useStaff().filter((u) => (u.role === 'staff' || u.role === 'family_staff') && u.active);
  const sigs = useSignatures(id).filter((x) => x.version === d?.version);
  const events = useDocEvents(id);
  if (!d) return <Screen title="Document"><Muted>Loading…</Muted></Screen>;

  const targets = d.audience === 'all_staff' ? staff : d.audience === 'assigned' ? staff.filter((u) => d.assignedTo.includes(u.id)) : [];
  const pending = d.requiresSignature ? targets.filter((u) => !sigs.some((x) => x.staffId === u.id)).length : 0;
  const stamp = (ms: number) => `${fmtDay(ms)}, ${fmtTime(ms)}`;

  return (
    <Screen title="Document">
      <Pressable onPress={() => router.replace('/admin/ebinders' as never)}><Text style={{ color: colors.primary, fontWeight: '600' }}>← Back to Compliance Documents</Text></Pressable>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <Card style={{ flexGrow: 2, flexBasis: 360, minWidth: 280 }}>
          <Muted>Document preview</Muted>
          <Text style={s.h1}>{d.title}</Text>
          <Text style={{ color: colors.ink, lineHeight: 22 }}>{renderBody(d.body, '________', '________')}</Text>
          {d.acks.map((a, i) => <Text key={i} style={{ color: colors.inkSoft }}>☐ {a}</Text>)}
        </Card>
        <View style={{ flexGrow: 1, flexBasis: 300, minWidth: 260, gap: 12 }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={s.h2}>{d.title}</Text>
              {d.requiresSignature && <Tag text={pending ? `${pending} pending` : 'All signed'} tone={pending ? 'amber' : 'green'} />}
            </View>
            <Muted>{d.folder} · v{d.version} · {audienceLabel[d.audience]} · Updated {fmtDay(d.updatedAt.toMillis())} by {d.uploadedByName}</Muted>
            <Btn label="Upload new version" tone="ghost" onPress={() => router.push({ pathname: '/admin/ebinder-new', params: { id: d.id } } as never)} />
          </Card>
          {d.requiresSignature && (
            <Card>
              <Text style={s.h2}>Signature status</Text>
              {targets.length === 0 && <Muted>No recipients.</Muted>}
              {targets.map((u) => {
                const sig = sigs.find((x) => x.staffId === u.id);
                return (
                  <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>{initials(u.name)}</Text></View>
                    <Text style={{ flex: 1, color: colors.ink, fontWeight: '600' }}>{u.name}</Text>
                    {sig ? <Text style={{ color: colors.green, fontSize: 13 }}>Signed {stamp(sig.signedAt.toMillis())}</Text> : <Tag text="Pending" tone="amber" />}
                  </View>
                );
              })}
            </Card>
          )}
          <Card>
            <Text style={s.h2}>Audit trail</Text>
            {events.length === 0 && <Muted>No activity yet.</Muted>}
            {events.map((e) => (
              <View key={e.id} style={{ paddingVertical: 4 }}>
                <Text style={{ color: colors.ink, fontSize: 14 }}>{e.text}</Text>
                <Text style={{ color: colors.inkFaint, fontSize: 12 }}>{e.at ? stamp(e.at.toMillis()) : ''}</Text>
              </View>
            ))}
          </Card>
        </View>
      </View>
    </Screen>
  );
}
