import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { firebaseConfigured } from '../lib/firebase';
import { Btn, Muted, s } from '../lib/ui';
import { colors } from '../lib/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch {
      // Deliberately generic: don't reveal whether the email exists.
      setError('Incorrect email or password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={[s.content, { flex: 1, justifyContent: 'center' }]}>
        <Text style={s.h1}>Daily Care Support</Text>
        <Muted>Sign in to continue</Muted>
        {!firebaseConfigured && (
          <Text style={{ color: colors.red }}>Backend not configured. Copy .env.example to .env.</Text>
        )}
        <TextInput
          style={s.input} placeholder="Email" autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" value={email} onChangeText={setEmail}
        />
        <TextInput
          style={s.input} placeholder="Password" secureTextEntry autoComplete="current-password"
          value={password} onChangeText={setPassword} onSubmitEditing={submit}
        />
        {error ? <Text style={{ color: colors.red }}>{error}</Text> : null}
        <Btn label="Log in" onPress={submit} busy={busy} disabled={!email || !password} />
      </View>
    </SafeAreaView>
  );
}
