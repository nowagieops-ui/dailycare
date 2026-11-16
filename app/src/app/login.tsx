import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { firebaseConfigured } from '../lib/firebase';
import { colors } from '../lib/theme';
import { Btn, Muted, s } from '../lib/ui';

export default function Login() {
  const { signIn } = useAuth();
  const web = Platform.OS === 'web';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await signIn(email, password, remember);
    } catch {
      setError('Incorrect email or password.'); // generic on purpose: don't reveal which part was wrong
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={[s.content, { flex: 1, justifyContent: 'center' }]}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>DC</Text>
        </View>
        <Text style={s.h1}>Daily Care Support</Text>
        <Muted>Log in with the email and password your agency gave you.</Muted>
        {!firebaseConfigured && <Text style={{ color: colors.red }}>Backend not configured. Copy .env.example to .env.</Text>}

        <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>Email</Text>
        <TextInput style={s.input} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>Password</Text>
        <TextInput style={s.input} secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => setRemember((r) => !r)} accessibilityRole="checkbox" accessibilityState={{ checked: remember }}>
            <Text style={{ color: colors.inkSoft }}>{remember ? '☑' : '☐'}  Remember me</Text>
          </Pressable>
          <Link href="/forgot-password" style={{ color: colors.primary, fontWeight: '600' }}>Forgot password?</Link>
        </View>
        {error ? <Text style={{ color: colors.red }}>{error}</Text> : null}
        <Btn label="Log In" onPress={submit} busy={busy} disabled={!email || !password} />

        {!web && (
          <>
            <Text style={{ textAlign: 'center', color: colors.inkFaint }}>OR</Text>
            <Link href="/onboarding" style={{ textAlign: 'center', color: colors.primary, fontWeight: '600' }}>New staff? Enter admin code</Link>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
