import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { functions } from '../lib/firebase';
import { colors } from '../lib/theme';
import { Btn, Muted, s } from '../lib/ui';

export default function Onboarding() {
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ok = code.trim() && name.trim() && email.includes('@') && pw.length >= 10 && pw === pw2 && agree;

  async function create() {
    setBusy(true);
    setError('');
    try {
      await httpsCallable(functions, 'redeemOnboardingCode')({ code, name, email, password: pw });
      await signIn(email, pw); // account exists now; sign straight in
    } catch (e) {
      setError((e as { message?: string }).message?.replace(/^.*?: /, '') || 'Could not create the account.');
    } finally { setBusy(false); }
  }

  const label = (t: string) => <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>{t}</Text>;
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { justifyContent: 'center', flexGrow: 1 }]}>
        <Text style={{ color: colors.inkFaint, fontWeight: '700', fontSize: 12 }}>Step 1 of 3 · Admin code</Text>
        <Text style={s.h1}>New DSP Onboarding</Text>
        <Muted>Enter the onboarding code your supervisor gave you, then set up your account.</Muted>
        {label('Admin onboarding code')}
        <TextInput style={s.input} autoCapitalize="characters" autoCorrect={false} placeholder="DCS-XXXX-XXXX" value={code} onChangeText={setCode} />
        {label('Full name')}
        <TextInput style={s.input} value={name} onChangeText={setName} autoComplete="name" />
        {label('Email')}
        <TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        {label('Create password (10+ characters)')}
        <TextInput style={s.input} secureTextEntry value={pw} onChangeText={setPw} autoComplete="new-password" />
        {label('Confirm password')}
        <TextInput style={s.input} secureTextEntry value={pw2} onChangeText={setPw2} />
        {pw2 !== '' && pw !== pw2 && <Text style={{ color: colors.red }}>Passwords don't match.</Text>}
        <Pressable onPress={() => setAgree((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }}>
          <Text style={{ color: colors.inkSoft }}>{agree ? '☑' : '☐'}  I agree to the Employee Handbook and confirm the information above is accurate.</Text>
        </Pressable>
        {error ? <Text style={{ color: colors.red }}>{error}</Text> : null}
        <Btn label="Create account" onPress={create} busy={busy} disabled={!ok} />
        <View><Link href="/login" style={{ textAlign: 'center', color: colors.primary, fontWeight: '600' }}>Already have an account? Log in</Link></View>
      </ScrollView>
    </SafeAreaView>
  );
}
