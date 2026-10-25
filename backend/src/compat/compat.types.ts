import type { UserRole } from '@prisma/client';

/** Legacy contracts kept stable for the existing frontend. */

export type LegacyRole = 'Principal' | 'Teacher' | 'Counselor' | 'Student';
export type LegacyMemberStatus = 'Active' | 'Inactive';
export type LegacyAttendanceStatus = 'Present' | 'Absent';
export type LegacyInventoryStatus = 'Active' | 'Faulty' | 'Unavailable';
export type LegacyFinancialCategory =
  | 'Tuition'
  | 'Lab & Library Fees'
  | 'PTA & Extracurricular'
  | 'Donations';
export type LegacyBroadcastCategory =
  | 'assignment'
  | 'test'
  | 'impromptu'
  | 'curriculum';

export interface LegacyTenant {
  id: string;
  name: string;
  logo_url: string;
  slug: string;
}

export interface LegacyUnit {
  id: string;
  tenant_id: string;
  name: string;
  parent_unit_id: string | null;
  description: string;
}

export interface LegacyMember {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  profile_picture_url: string;
  dob_month: number;
  dob_day: number;
  role: LegacyRole;
  position: string;
  unit_id: string | null;
  status: LegacyMemberStatus;
  joined_date: string;
  academic_score?: number;
  office_location?: string;
  office_hours?: string;
  bio?: string;
  specialization?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  user_id?: string | null;
  guardian_id?: string | null;
  guardian_user_id?: string | null;
}

/** Restricted view returned to non-admin callers (sensitive fields omitted). */
export type MemberView =
  | LegacyMember
  | Omit<
      LegacyMember,
      | 'email'
      | 'phone'
      | 'address'
      | 'dob_month'
      | 'dob_day'
      | 'joined_date'
      | 'guardian_name'
      | 'guardian_email'
      | 'guardian_phone'
      | 'user_id'
      | 'guardian_id'
      | 'guardian_user_id'
    >;

export interface LegacyAttendanceSheetItem {
  memberId: string;
  memberName: string;
  role: LegacyRole;
  position: string;
  status: LegacyAttendanceStatus;
  isMarked: boolean;
}

export interface LegacyAttendanceSheetResponse {
  serviceDate: string;
  serviceName: string;
  sheet: LegacyAttendanceSheetItem[];
}

export interface LegacyWorkerPerformance {
  memberId: string;
  name: string;
  role: LegacyRole;
  position: string;
  unit_id: string | null;
  presentCount: number;
  totalServices: number;
  attendanceRate: number;
}

export interface LegacyRecentServiceSummary {
  name: string;
  date: string;
  present: number;
  total: number;
  rate: number;
  status: 'Closed' | 'Open';
}

export interface LegacyAttendanceStatsResponse {
  type: string;
  avgAttendanceRate: number;
  memberPerformance: LegacyWorkerPerformance[];
  recentServices: LegacyRecentServiceSummary[];
}

export interface LegacyInventoryItem {
  id: string;
  tenant_id: string;
  item_name: string;
  description: string;
  status: LegacyInventoryStatus;
  unit_id: string | null;
  updated_at: string;
}

export interface LegacyFinancialRecord {
  id: string;
  tenant_id: string;
  member_id: string | null;
  amount: number;
  category: LegacyFinancialCategory;
  payment_method: string;
  reference?: string | null;
  transaction_date: string;
  recorded_by: string | null;
}

export interface LegacyFinancialLedgerItem extends LegacyFinancialRecord {
  contributorName: string;
}

export interface LegacyFinancialProjections {
  summary: {
    Tuition: number;
    'Lab & Library Fees': number;
    'PTA & Extracurricular': number;
    Donations: number;
    Total: number;
  };
  weeklyHistorical: Array<{ name: string; amount: number }>;
  transactionCount: number;
  growthRatePercent: number;
  projectedNextWeek: number;
}

export interface LegacyBroadcast {
  id: string;
  tenant_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: LegacyRole;
  target: 'all' | 'unit' | 'first-timers';
  unit_id: string | null;
  category: LegacyBroadcastCategory;
  title: string;
  message: string;
  event_date?: string;
  attachment?: unknown;
  bulk_mailed: boolean;
  recipient_count: number;
  sent_at: string;
}

export interface LegacyCourseGrade {
  id: string;
  subject: string;
  score: number;
  teacher: string;
  term: string;
  comments?: string;
}

export interface LegacyStudentPortal {
  id: string;
  tenant_id: string;
  student_id: string;
  student_name: string;
  grade_level: string;
  overall_score: number;
  term: string;
  grades: LegacyCourseGrade[];
  teacher_remarks: string;
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_relation: string;
  syllabus_attachments: Array<{
    title: string;
    filename: string;
    uploaded_by: string;
    date: string;
  }>;
  last_updated_by: string;
  updated_at: string;
}

export interface MemberActor {
  id: string;
  tenantId: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

export const ADMIN_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
];

export const STAFF_ROLES: UserRole[] = [
  ...ADMIN_ROLES,
  'TEACHER',
  'LIBRARIAN',
];

export const FINANCE_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'PRINCIPAL',
  'ACCOUNTANT',
];
