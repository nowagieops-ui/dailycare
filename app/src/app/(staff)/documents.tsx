import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useAuth } from '../../lib/auth';
import { stageOf, stageTone, useCredentials } from '../../lib/credentials';
import { daysLeft, stageLabel } from '../../lib/expiry';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Card, Eyebrow, fmtDay, Muted, RowLink, Tag } from '../../lib/ui';

export default function Documents() {
  const { profile } = useAuth();
  const creds = useCredentials(profile?.uid);
  return (
    <StaffScreen title="My Documents">
      <Pressable onPress={() => router.push('/training')}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>View Training & Credentials →</Text>
      </Pressable>

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
            <Muted>{d < 0 ? `Expired ${fmtDay(c.expiresOn.toMillis())}` : st === 'ok' ? `Valid through ${fmtDay(c.expiresOn.toMillis())}` : `Expires in ${d} days`} · {stageLabel[st]}</Muted>
          </Card>
        );
      })}

      <Eyebrow>Files shared with you</Eyebrow>
      <RowLink icon="folder-outline" title="Shared files" sub="Care plans and agency documents" href="/files" />
    </StaffScreen>
  );
}
