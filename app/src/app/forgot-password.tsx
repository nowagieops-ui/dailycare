import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../lib/firebase';
import { colors } from '../lib/theme';
import { Btn, Muted, s } from '../lib/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    await sendPasswordResetEmail(auth, email.trim()).catch(() => {});
    setSent(true); // same message either way, so this can't be used to find out who has an account
    setBusy(false);
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={[s.content, { flex: 1, justifyContent: 'center' }]}>
        <Text style={s.h1}>Reset your password</Text>
        <Muted>Enter the email on your account and we'll send a link to reset your password.</Muted>
        <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>Email</Text>
        <TextInput style={s.input} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        {sent && <Text style={{ color: colors.green }}>If an account exists for that email, a reset link is on its way.</Text>}
        <Btn label="Send reset link" onPress={send} busy={busy} disabled={!email.includes('@')} />
        <Link href="/login" style={{ textAlign: 'center', color: colors.primary, fontWeight: '600' }}>Back to log in</Link>
      </View>
    </SafeAreaView>
  );
}
