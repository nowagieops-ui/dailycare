import { DriveBrowser } from '../../components/DriveBrowser';
import { useAuth } from '../../lib/auth';
import { Screen } from '../../lib/ui';

export default function SharedFiles() {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <Screen title="Shared files">
      <DriveBrowser mode="staff" uid={profile.uid} role={profile.role} />
    </Screen>
  );
}
