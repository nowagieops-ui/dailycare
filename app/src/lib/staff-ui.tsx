import type { ReactNode } from 'react';
import { useAuth } from './auth';
import { Screen, StaffHeader } from './ui';

export const ROLE_LABEL: Record<string, string> = {
  staff: 'Direct Support Professional',
  family_staff: 'Family Staff',
  admin: 'Office Admin',
  super_admin: 'Super Admin',
  case_manager: 'Case Manager',
};

/** Standard staff screen: mockup header (avatar, bell, settings) above a titled scroll area. */
export function StaffScreen({ title, children }: { title: string; children: ReactNode }) {
  const { profile } = useAuth();
  return (
    <Screen
      title={title}
      header={<StaffHeader name={profile?.name ?? ''} roleLabel={ROLE_LABEL[profile?.role ?? 'staff']} />}
    >
      {children}
    </Screen>
  );
}
