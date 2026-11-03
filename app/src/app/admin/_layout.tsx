import { Slot } from 'expo-router';
import { AdminShell } from '../../lib/admin-shell';

export default function AdminLayout() {
  return <AdminShell><Slot /></AdminShell>;
}
