import { DriveBrowser } from '../../components/DriveBrowser';
import { useAuth } from '../../lib/auth';
import { StaffScreen } from '../../lib/staff-ui';

export default function SharedFiles() {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <StaffScreen title="Shared files">
      <DriveBrowser mode="staff" uid={profile.uid} role={profile.role} name={profile.name} />
    </StaffScreen>
  );
}
