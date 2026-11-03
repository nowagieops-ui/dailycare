import type { Timestamp } from 'firebase/firestore';

export type Role = 'staff' | 'family_staff' | 'admin' | 'super_admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  startDate?: string; // YYYY-MM-DD
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
  staffName?: string;
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

export const SERVICE_LINES = [
  'Residential', 'Supported Living', 'Personal Support', 'Respite',
  'Community Development', 'Nursing Support', 'Transportation',
] as const;

export interface Client {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusM: number;
  serviceLines: string[]; // a client can have several
  defaultTasks: string[];
  dob?: string; // YYYY-MM-DD
  contactName?: string; // primary contact / guardian
  contactPhone?: string;
  goals?: string[]; // ISP / care plan support goals
  lastReviewed?: string; // YYYY-MM-DD
  nextReview?: string;
}

export interface AlertDoc {
  id: string;
  type: 'left_site';
  staffName: string;
  clientName: string;
  at: Timestamp;
  resolved: boolean;
}

export type CredentialKind = 'training' | 'certification' | 'document';

export interface Credential {
  id: string;
  staffId: string;
  staffName: string;
  title: string;
  kind: CredentialKind;
  expiresOn: Timestamp;
}

export interface MissedClockIn {
  id: string;
  staffId: string;
  staffName: string;
  shiftId: string;
  clientName: string;
  reason: string;
  clockIn: Timestamp;
  clockOut: Timestamp;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
}

export interface DriveItem {
  id: string;
  type: 'folder' | 'file';
  name: string;
  parentId: string | null;
  path: string[]; // ids of every ancestor, root first
  ownerId: string;
  ownShares: { key: string; level: 'view' | 'upload' }[];
  viewers: string[]; // effective access (own + inherited)
  uploaders: string[];
  sharedRoot: boolean; // true where a share was set directly; staff see these at their top level
  size?: number;
  contentType?: string;
  createdAt: Timestamp;
}
