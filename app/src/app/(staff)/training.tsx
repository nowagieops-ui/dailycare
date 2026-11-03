import { Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { hasTraining, stageOf, stageTone, useCredentials, useRequiredTrainings } from '../../lib/credentials';
import { daysLeft } from '../../lib/expiry';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { BANDS } from '../../lib/types';
import { Card, Eyebrow, fmtDay, Muted, Tag } from '../../lib/ui';

export default function Training() {
  const { profile } = useAuth();
  const creds = useCredentials(profile?.uid);
  const required = useRequiredTrainings();
  const missing = required.filter((t) => !hasTraining(creds, profile?.uid ?? '', t));

  return (
    <StaffScreen title="Training & Credentials">
      <Eyebrow>Required now</Eyebrow>
      {missing.length === 0 && <Muted>You're all caught up.</Muted>}
      {missing.map((t) => (
        <Card key={t.id} style={{ borderColor: colors.amber }}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{t.title}</Text>
          <Muted>{t.band} · ask the office to record it once you've completed it</Muted>
        </Card>
      ))}

      {BANDS.map((b) => {
        const r = required.filter((t) => t.band === b);
        if (!r.length) return null;
        const done = r.filter((t) => hasTraining(creds, profile?.uid ?? '', t)).length;
        return (
          <Card key={b}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View><Text style={{ fontWeight: '700', color: colors.ink }}>{b}{b === 'MD DDA' ? ' — state-mandated' : ''}</Text><Muted>{done} of {r.length} complete</Muted></View>
              <Tag text={done === r.length ? 'Done' : `${r.length - done} remaining`} tone={done === r.length ? 'green' : 'amber'} />
            </View>
          </Card>
        );
      })}

      <Eyebrow>Credentials</Eyebrow>
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
    </StaffScreen>
  );
}
