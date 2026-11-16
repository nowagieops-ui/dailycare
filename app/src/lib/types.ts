import type { Timestamp } from 'firebase/firestore';

export type Role = 'staff' | 'family_staff' | 'admin' | 'super_admin' | 'case_manager';

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
  approved?: boolean; // timesheet approved by an admin
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
  authorName: string;
}

/** Uses the admin console (admins and case managers). */
export const isAdmin = (r: Role) => r === 'admin' || r === 'super_admin' || r === 'case_manager';
/** Can change schedules, accounts and settings (case managers are view-only there). */
export const canAdminister = (r: Role | undefined) => r === 'admin' || r === 'super_admin';

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
  band?: TrainingBand;
  expiresOn: Timestamp;
}

export const BANDS = ['Competency', 'MD DDA', 'Agency Specific'] as const;
export type TrainingBand = (typeof BANDS)[number];

/** A training every active staff member must hold (completion = a non-expired credential with the same title). */
export interface RequiredTraining { id: string; title: string; band: TrainingBand }

export interface MissedClockIn {
  id: string;
  staffId: string;
  staffName: string;
  shiftId: string;
  clientName: string;
  reason: string; // the chosen reason (and any extra details)
  fullName?: string; // as typed on the form
  missed?: 'in' | 'out' | 'both';
  clockIn?: Timestamp; // present when the clock-in was missed
  clockOut?: Timestamp; // present when the clock-out was missed
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
  ownerName?: string; // who added it (shown as "Updated by")
  linked?: boolean; // true for the Individuals tree: office roles can read it and its files mirror into eBinders
  clientId?: string; // the client this folder or file belongs to
  ebinderFolder?: string; // eBinder folder name this maps to ('' = the client's top folder, shown as General)
  ebinderDocId?: string; // the eBinder document this file is linked to
  fromEbinder?: boolean; // true when the file's bytes live in eBinder storage (uploaded there first)
  size?: number;
  contentType?: string;
  createdAt: Timestamp;
}
