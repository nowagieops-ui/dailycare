import { Redirect, Slot, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { isAdmin } from '../lib/types';
import '../lib/geofence'; // registers the background geofence task at startup

function Guard() {
  const { loading, profile } = useAuth();
  const segments = useSegments();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  const onLogin = segments[0] === 'login';
  if (!profile) return onLogin ? <Slot /> : <Redirect href="/login" />;
  // Role-based landing: admins -> /admin, everyone else -> staff tabs.
  const home = isAdmin(profile.role) ? '/admin' : '/(staff)';
  if (onLogin) return <Redirect href={home} />;
  const inAdmin = segments[0] === 'admin';
  if (inAdmin !== isAdmin(profile.role)) return <Redirect href={home} />;
  return <Slot />;
}

export default function Root() {
  return (
    <AuthProvider>
      <Guard />
    </AuthProvider>
  );
}
