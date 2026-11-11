import { useLocalSearchParams } from 'expo-router';
import { DriveBrowser } from '../../components/DriveBrowser';
import { useAuth } from '../../lib/auth';
import { Muted, Screen } from '../../lib/ui';

export default function Files() {
  const { profile } = useAuth();
  const { folder } = useLocalSearchParams<{ folder?: string }>();
  if (!profile || profile.role !== 'super_admin') {
    return <Screen title="Files"><Muted>Only a super admin can manage files.</Muted></Screen>;
  }
  return (
    <Screen title="Files">
      <DriveBrowser mode="super" uid={profile.uid} role={profile.role} name={profile.name} startFolderId={folder ? String(folder) : undefined} />
    </Screen>
  );
}
