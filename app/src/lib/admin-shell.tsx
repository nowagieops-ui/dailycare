import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './auth';
import { colors } from './theme';
import { EmbeddedCtx, initials } from './ui';

type Item = { href: string; label: string; icon: keyof typeof Ionicons.glyphMap; superOnly?: boolean };

// Sidebar order follows the mockup; the second group holds the owner's extra tools.
const MAIN: Item[] = [
  { href: '/admin', label: 'Dashboard', icon: 'grid-outline' },
  { href: '/admin/scheduling', label: 'Scheduling', icon: 'calendar-outline' },
  { href: '/admin/staff', label: 'Staff', icon: 'people-outline' },
  { href: '/admin/clients', label: 'Clients', icon: 'business-outline' },
  { href: '/admin/ebinders', label: 'eBinders', icon: 'folder-open-outline' },
  { href: '/admin/training', label: 'Training & Credentials', icon: 'ribbon-outline' },
  { href: '/admin/attendance', label: 'Attendance', icon: 'time-outline' },
  { href: '/admin/reports', label: 'Reports', icon: 'bar-chart-outline' },
  { href: '/admin/settings', label: 'Settings', icon: 'settings-outline' },
];
const MORE: Item[] = [
  { href: '/admin/announcements', label: 'Announcements', icon: 'megaphone-outline' },
  { href: '/admin/requests', label: 'Missed clock-ins', icon: 'alert-circle-outline' },
  { href: '/admin/records', label: 'Visit records', icon: 'document-text-outline' },
  { href: '/admin/files', label: 'File manager', icon: 'file-tray-full-outline', superOnly: true },
];

const TITLES: Record<string, string> = {
  '/admin/notifications': 'Notifications', '/admin/search': 'Search', '/admin/ebinder-new': 'Upload document', '/admin/document-detail': 'Compliance Documents', '/admin/add-shift': 'New shift', '/admin/staff-detail': 'Staff detail','/admin/audit': 'Audit log',
  '/admin/add-staff': 'Add staff member', '/admin/add-client': 'New Client Intake', '/admin/client-detail': 'Client detail',
};
const isActive = (path: string, href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));
const titleOf = (path: string) =>
  TITLES[path] ?? [...MAIN, ...MORE].find((i) => isActive(path, i.href))?.label ?? 'Admin';

function Nav({ path, onGo }: { path: string; onGo: () => void }) {
  const { profile, signOutUser } = useAuth();
  const link = (i: Item) => {
    if (i.superOnly && profile?.role !== 'super_admin') return null;
    const on = isActive(path, i.href);
    return (
      <Pressable
        key={i.href} accessibilityRole="link" onPress={() => { onGo(); router.push(i.href as never); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: on ? 'rgba(255,255,255,0.16)' : 'transparent' }}
      >
        <Ionicons name={i.icon} size={18} color={on ? '#fff' : 'rgba(255,255,255,0.7)'} />
        <Text style={{ color: on ? '#fff' : 'rgba(255,255,255,0.78)', fontWeight: on ? '700' : '500', fontSize: 14 }}>{i.label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.navy, padding: 16, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 16 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>DC</Text>
        </View>
        <View>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Daily Care Support</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>Admin Console</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ gap: 2 }}>
        {MAIN.map(link)}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginVertical: 10 }} />
        {MORE.map(link)}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{initials(profile?.name ?? '')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{profile?.name}</Text>
          <Pressable onPress={signOutUser} accessibilityRole="button"><Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>Log out</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

/** Mockup admin console: fixed sidebar + top bar on wide screens; hamburger drawer on phones. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { profile } = useAuth();
  const [q, setQ] = useState('');

  const topbar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      {!wide && (
        <Pressable accessibilityLabel="Open menu" onPress={() => setOpen(true)} style={{ padding: 4 }}>
          <Ionicons name="menu" size={26} color={colors.navy} />
        </Pressable>
      )}
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800', color: colors.navy, flex: 1 }}>{titleOf(path)}</Text>
      {wide && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.tint, borderRadius: 10, paddingHorizontal: 12, width: 280 }}>
          <Ionicons name="search" size={16} color={colors.inkFaint} />
          <TextInput
            value={q} onChangeText={setQ} placeholder="Search staff, clients, documents" placeholderTextColor={colors.inkFaint}
            onSubmitEditing={() => { if (q.trim()) router.push({ pathname: '/admin/search', params: { q: q.trim() } } as never); }}
            style={{ flex: 1, paddingVertical: 9, fontSize: 13, color: colors.ink, outlineStyle: 'none' } as never}
          />
        </View>
      )}
      <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/admin/notifications' as never)} style={{ padding: 6 }}>
        <Ionicons name="notifications-outline" size={22} color={colors.primary} />
      </Pressable>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{initials(profile?.name ?? '')}</Text>
      </View>
    </View>
  );

  const content = <EmbeddedCtx.Provider value>{children}</EmbeddedCtx.Provider>;

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <View style={{ width: 248 }}><Nav path={path} onGo={() => {}} /></View>
        <View style={{ flex: 1 }}>{topbar}{content}</View>
      </View>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {topbar}
      {content}
      {open && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
          <View style={{ width: 272 }}><SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}><Nav path={path} onGo={() => setOpen(false)} /></SafeAreaView></View>
          <Pressable accessibilityLabel="Close menu" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        </View>
      )}
    </SafeAreaView>
  );
}
