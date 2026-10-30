import { Btn, Card, Muted, Screen } from '../lib/ui';
import { useAuth } from '../lib/auth';

export default function AdminHome() {
  const { profile, signOutUser } = useAuth();
  return (
    <Screen title="Admin">
      <Card>
        <Muted>Signed in as {profile?.name} ({profile?.role}).</Muted>
        <Muted>Dashboard screens are built next: shifts, staff, clients, alerts.</Muted>
      </Card>
      <Btn label="Log out" tone="ghost" onPress={signOutUser} />
    </Screen>
  );
}
