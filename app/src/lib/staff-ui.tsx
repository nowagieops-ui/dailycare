import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './auth';
import { colors } from './theme';
import { Screen, StaffHeader } from './ui';

// The bottom tabs are the top level of the staff app; every other screen gets a Back button.
const TAB_ROOTS = ['/', '/schedule', '/clock-in', '/tasks', '/notes', '/documents'];

/** Goes to the previous screen, or home when the page was opened directly (e.g. a reload). */
export function goBack(fallback = '/') {
  if (router.canGoBack()) router.back(); else router.replace(fallback as never);
}

export function BackButton({ label = 'Back', fallback = '/' }: { label?: string; fallback?: string }) {
  return (
    <Pressable onPress={() => goBack(fallback)} accessibilityRole="button" accessibilityLabel="Go back"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 }}>
      <Ionicons name="chevron-back" size={20} color={colors.primary} />
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export const ROLE_LABEL: Record<string, string> = {
  staff: 'Direct Support Professional',
  family_staff: 'Family DSP',
  admin: 'Office Admin',
  super_admin: 'Super Admin',
  case_manager: 'Case Manager',
};

/** Standard staff screen: mockup header (avatar, bell, settings) above a titled scroll area. */
export function StaffScreen({ title, children }: { title: string; children: ReactNode }) {
  const { profile } = useAuth();
  const path = usePathname().replace(/\/+$/, '') || '/';
  return (
    <Screen
      title={title}
      header={<StaffHeader name={profile?.name ?? ''} roleLabel={ROLE_LABEL[profile?.role ?? 'staff']} />}
    >
      {!TAB_ROOTS.includes(path) && <BackButton />}
      {children}
    </Screen>
  );
}
