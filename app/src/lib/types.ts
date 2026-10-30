import type { Timestamp } from 'firebase/firestore';

export type Role = 'staff' | 'family_staff' | 'admin' | 'super_admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
}

export interface Task {
  id: string;
  label: string;
  done: boolean;
}

export type ShiftStatus = 'scheduled' | 'clocked_in' | 'completed';

export interface Shift {
  id: string;
  staffId: string;
  staffPhone?: string;
  clientId: string;
  clientName: string;
  serviceLine: string;
  address: string;
  lat: number;
  lng: number;
  radiusM: number;
  start: Timestamp;
  end: Timestamp;
  status: ShiftStatus;
  clockInAt?: Timestamp;
  clockInLat?: number;
  clockInLng?: number;
  clockOutAt?: Timestamp;
  tasks: Task[];
  note: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
  authorName: string;
}

export const isAdmin = (r: Role) => r === 'admin' || r === 'super_admin';
