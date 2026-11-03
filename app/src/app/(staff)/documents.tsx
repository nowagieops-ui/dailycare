import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { stageOf, stageTone, useCredentials } from '../../lib/credentials';
import { useSignedIds, useStaffDocs, type EDoc } from '../../lib/ebinder';
import { daysLeft } from '../../lib/expiry';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Btn, Card, Eyebrow, fmtDay, Muted, Tag } from '../../lib/ui';

export default function Documents() {
  const { profile } = useAuth();
  const creds = useCredentials(profile?.uid);
  const docs = useStaffDocs(profile?.uid);
  const signed = useSignedIds(docs, profile?.uid);
  const open = (d: EDoc) => router.push({ pathname: '/document', params: { id: d.id } } as never);

  const plans = docs.filter((d) => d.folder === 'Care Plans');
  const hr = docs.filter((d) => d.folder !== 'Care Plans');
  const needSign = hr.filter((d) => d.requiresSignature && !signed[d.id]).length;

  return (
    <StaffScreen title="My Documents">
      <Pressable onPress={() => router.push('/training')}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>View Training & Credentials →</Text>
      </Pressable>

      {needSign > 0 && (
        <Card style={{ backgroundColor: colors.amberBg, borderColor: colors.amber }}>
          <Text style={{ color: colors.ink, fontWeight: '600' }}>{needSign} document{needSign === 1 ? '' : 's'} need{needSign === 1 ? 's' : ''} your signature before your next shift</Text>
        </Card>
      )}

      <Eyebrow>Care plans — view only</Eyebrow>
      {plans.length === 0 && <Muted>No care plans shared with you.</Muted>}
      {plans.map((d) => (
        <Pressable key={d.id} onPress={() => open(d)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '600', flex: 1 }}>{d.title}</Text><Tag text="Current" tone="green" />
            </View>
            <Muted>Updated {fmtDay(d.updatedAt.toMillis())}</Muted>
          </Card>
        </Pressable>
      ))}

      <Eyebrow>Training & certifications</Eyebrow>
      {creds.length === 0 && <Muted>Nothing on file yet.</Muted>}
      {creds.map((c) => {
        const d = daysLeft(c.expiresOn.toMillis());
        const st = stageOf(d);
        return (
          <Card key={c.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '600', flex: 1 }}>{c.title}</Text>
              <Tag text={st === 'ok' ? 'Valid' : st === 'expired' ? 'Expired' : 'Renew soon'} tone={stageTone(st)} />
            </View>
            <Muted>{d < 0 ? `Expired ${fmtDay(c.expiresOn.toMillis())}` : st === 'ok' ? `Valid through ${fmtDay(c.expiresOn.toMillis())}` : `Expires in ${d} days`}</Muted>
          </Card>
        );
      })}

      <Eyebrow>HR & compliance</Eyebrow>
      {hr.length === 0 && <Muted>No documents yet.</Muted>}
      {hr.map((d) => {
        const done = !d.requiresSignature || signed[d.id];
        return (
          <Card key={d.id}>
            <Text style={{ fontWeight: '600' }}>{d.title}</Text>
            <Muted>{d.folder} · v{d.version}</Muted>
            {done ? <Pressable onPress={() => open(d)}><Tag text={d.requiresSignature ? 'Signed' : 'View'} tone="green" /></Pressable>
              : <Btn label="Review & Sign" onPress={() => open(d)} />}
          </Card>
        );
      })}
    </StaffScreen>
  );
}
