import { useState } from 'react';
import { Text } from 'react-native';
import { getApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc } from 'firebase/firestore';
import { DateField, TimeField } from '../../components/DateTimeFields';
import { useAuth } from '../../lib/auth';
import { auth, config, db, functions } from '../../lib/firebase';
import type { Role } from '../../lib/types';
import { Btn, Card, Chips, Field, Muted, s, Screen } from '../../lib/ui';

const ROLE_LABEL: Record<Role, string> = {
  staff: 'Staff', family_staff: 'Family Staff', admin: 'Admin', super_admin: 'Super Admin', case_manager: 'Case Manager',
};

/** A second Firebase app instance, so creating an account doesn't sign the admin out. */
function secondaryAuth() {
  let app;
  try { app = getApp('secondary'); } catch { app = initializeApp(config, 'secondary'); }
  return getAuth(app);
}

function randomPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24) + 'A1!';
}

export default function AddStaff() {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const isSuper = profile?.role === 'super_admin';
  const roles: Role[] = isSuper ? ['staff', 'family_staff', 'case_manager', 'admin', 'super_admin'] : ['staff', 'family_staff'];

  const [code, setCode] = useState('');
  async function makeCode() {
    const { data } = await httpsCallable<{ role: Role }, { code: string; expiresAt: number }>(functions, 'createOnboardingCode')({ role });
    setCode(`${data.code}  ·  expires ${new Date(data.expiresAt).toLocaleDateString()} · single use`);
  }

  async function create() {
    setBusy(true);
    setMsg('');
    try {
      const sAuth = secondaryAuth();
      const cred = await createUserWithEmailAndPassword(sAuth, email.trim(), randomPassword());
      await signOut(sAuth);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), role, active: true, ...(startDate ? { startDate } : {}),
      });
      // The person sets their own password from this email; no password is ever shared.
      await sendPasswordResetEmail(auth, email.trim());
      setMsg(`Added ${name}. They were emailed a link to set their password.`);
      setName(''); setEmail(''); setPhone(''); setStartDate(''); setRole('staff');
    } catch {
      setMsg('Could not add this person (email may already be in use).');
    } finally { setBusy(false); }
  }

  return (
    <Screen title="Add staff member">
      <Card>
        <Text style={s.h2}>Staff details</Text>
        <Field label="Full name" value={name} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <DateField label="Start date (optional)" value={startDate} onChange={setStartDate} optional />
        <Text style={{ fontWeight: '600' }}>Role</Text>
        <Chips options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} selected={[role]} onToggle={setRole} />
        {role === 'family_staff' && <Muted>Family Staff work like regular staff but under a specific waiver.</Muted>}
        <Btn label="Add and email invite" onPress={create} busy={busy} disabled={!name.trim() || !email.includes('@')} />
        {msg ? <Muted>{msg}</Muted> : null}
      </Card>
      <Card>
        <Text style={s.h2}>Or generate an onboarding code</Text>
        <Muted>New staff can skip email invites and create their own account in the staff app with a one-time code. The code gives them the role selected above.</Muted>
        {code ? <Text selectable style={{ fontWeight: '700', fontSize: 15 }}>{code}</Text> : null}
        <Btn label={code ? 'Generate new code' : 'Generate code'} tone="ghost" onPress={makeCode} disabled={role !== 'staff' && role !== 'family_staff'} />
      </Card>
    </Screen>
  );
}
