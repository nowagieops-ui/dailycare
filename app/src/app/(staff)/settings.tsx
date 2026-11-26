import { useEffect, useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { startTour } from '../../components/Tour';
import { useAuth } from '../../lib/auth';
import { auth, db } from '../../lib/firebase';
import { usePrefs } from '../../lib/prefs';
import { ROLE_LABEL, StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Btn, Card, Eyebrow, initials, Muted, RowLink } from '../../lib/ui';

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ fontSize: 15, color: colors.ink }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} accessibilityLabel={label} />
    </View>
  );
}

export default function Settings() {
  const [office, setOffice] = useState('');
  useEffect(() => onSnapshot(doc(db, 'settings', 'agency'), (d) => setOffice(d.data()?.phone ?? ''), () => {}), []);
  const { profile, signOutUser } = useAuth();
  const { prefs, set } = usePrefs(profile?.uid);
  const [msg, setMsg] = useState('');
  if (!profile) return null;

  return (
    <StaffScreen title="Settings">
      <Btn label="Take a Tour" tone="ghost" onPress={() => startTour('dsp')} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{initials(profile.name)}</Text>
        </View>
        <View>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{profile.name}</Text>
          <Muted>{ROLE_LABEL[profile.role]}</Muted>
        </View>
      </Card>

      <Eyebrow>Account</Eyebrow>
      <Card>
        <Btn label="Change password" tone="ghost" onPress={async () => {
          await sendPasswordResetEmail(auth, profile.email).catch(() => {});
          setMsg(`We emailed a password reset link to ${profile.email}.`);
        }} />
        {msg ? <Muted>{msg}</Muted> : null}
        <ToggleRow label="Push notifications" value={prefs.push} onChange={(v) => set({ push: v })} />
        <ToggleRow label="Shift reminders" value={prefs.shiftReminders} onChange={(v) => set({ shiftReminders: v })} />
        <ToggleRow label="Email digest" value={prefs.emailDigest} onChange={(v) => set({ emailDigest: v })} />
      </Card>

      <Eyebrow>Support</Eyebrow>
      {office ? (
        <Pressable onPress={() => Linking.openURL(`tel:${office.replace(/[^0-9+]/g, '')}`)}>
          <Card><Text style={{ fontWeight: '600', color: colors.ink }}>Contact the office</Text><Muted>{office}</Muted></Card>
        </Pressable>
      ) : null}
      <Pressable onPress={() => Linking.openURL('https://dailycaresupport.com/privacy-policy/')}><Card><Text style={{ fontWeight: '600', color: colors.ink }}>Privacy policy</Text></Card></Pressable>
      <Pressable onPress={() => Linking.openURL('https://dailycaresupport.com/terms--conditions/')}><Card><Text style={{ fontWeight: '600', color: colors.ink }}>Terms & conditions</Text></Card></Pressable>
      <RowLink icon="alert-circle-outline" title="Report a missed clock-in" href="/missed" />
      <RowLink icon="calendar-outline" title="Sync shifts to my calendar" href="/calendar" />
      <RowLink icon="folder-outline" title="Shared files" href="/files" />

      <Btn label="Log out" tone="danger" onPress={async () => { await signOutUser(); router.replace('/login'); }} />
    </StaffScreen>
  );
}
