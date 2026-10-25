/**
 * SchoolBook SMS - Unified Shared Types
 * Strongly typed contracts shared between backend and frontend.
 */

export type Role = 'Principal' | 'Teacher' | 'Counselor' | 'Student';

export type MemberStatus = 'Active' | 'Inactive';

export interface Tenant {
  id: string;
  name: string;
  logo_url: string;
}

export interface Unit {
  id: string;
  tenant_id: string;
  name: string;
  parent_unit_id: string | null;
  description: string;
}

export interface Member {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  profile_picture_url: string;
  dob_month: number;
  dob_day: number;
  role: Role;
  position: string;
  unit_id: string | null;
  status: MemberStatus;
  joined_date: string;
  // Academic & Staff Extensions
  academic_score?: number; // 0-100: >70 Green, 50-69 Yellow, <50 Red
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

export interface MemberProfileSummary {
  id: string;
  name: string;
  role: Role;
  position: string;
  tenant_id: string;
  profile_picture_url: string;
  unit_id: string | null;
  academic_score?: number;
}

export type AttendanceStatus = 'Present' | 'Absent';

export interface Attendance {
  id: string;
  tenant_id: string;
  member_id: string;
  service_date: string; // YYYY-MM-DD (session date)
  service_name: string; // Session/Class name (e.g., Morning Roll Call)
  status: AttendanceStatus;
  recorded_by: string | null;
  recorded_at: string;
}

export interface AttendanceSheetItem {
  memberId: string;
  memberName: string;
  role: Role;
  position: string;
  status: AttendanceStatus;
  isMarked: boolean;
}

export interface AttendanceSheetResponse {
  serviceDate: string;
  serviceName: string;
  sheet: AttendanceSheetItem[];
}

export interface WorkerPerformance {
  memberId: string;
  name: string;
  role: Role;
  position: string;
  unit_id: string | null;
  presentCount: number;
  totalServices: number;
  attendanceRate: number;
}

export type StudentPerformance = WorkerPerformance;

export interface RecentServiceSummary {
  name: string;
  date: string;
  present: number;
  total: number;
  rate: number;
  status: 'Closed' | 'Open';
}

export interface AttendanceStatsResponse {
  type: string;
  avgAttendanceRate: number;
  memberPerformance: WorkerPerformance[];
  recentServices: RecentServiceSummary[];
}

export type InventoryStatus = 'Active' | 'Faulty' | 'Unavailable';

export interface InventoryItem {
  id: string;
  tenant_id: string;
  item_name: string;
  description: string;
  status: InventoryStatus;
  unit_id: string | null;
  updated_at: string;
}

export type FinancialCategory = 'Tuition' | 'Lab & Library Fees' | 'PTA & Extracurricular' | 'Donations';

export interface FinancialRecord {
  id: string;
  tenant_id: string;
  member_id: string | null;
  amount: number;
  category: FinancialCategory;
  payment_method: string;
  reference?: string | null;
  transaction_date: string;
  recorded_by: string | null;
}

export interface FinancialLedgerItem extends FinancialRecord {
  contributorName: string;
}

export interface FinancialProjections {
  summary: {
    Tuition: number;
    'Lab & Library Fees': number;
    'PTA & Extracurricular': number;
    Donations: number;
    Total: number;
  };
  transactionCount: number;
  growthRatePercent: number;
  projectedNextWeek: number;
}

export type BroadcastCategory = 'assignment' | 'test' | 'impromptu' | 'curriculum';

export interface BroadcastAttachment {
  name: string;
  url: string;
  size?: string;
  type?: string;
}

export interface BroadcastMessage {
  id: string;
  tenant_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: Role;
  target: 'all' | 'unit' | 'first-timers';
  unit_id: string | null;
  category: BroadcastCategory;
  title: string;
  message: string;
  event_date?: string; // due date or test date
  attachment?: BroadcastAttachment;
  bulk_mailed: boolean;
  recipient_count: number;
  sent_at: string;
}

export interface BroadcastResponse {
  message: string;
  recipientCount: number;
  recipients: string[];
  broadcast?: BroadcastMessage;
}

export interface CourseGrade {
  id: string;
  subject: string;
  score: number; // 0-100
  teacher: string;
  term: string;
  comments?: string;
}

export interface StudentPortal {
  id: string;
  tenant_id: string;
  student_id: string;
  student_name: string;
  grade_level: string;
  overall_score: number; // 0-100: >70 Green, 50-69 Yellow, <50 Red
  term: string;
  grades: CourseGrade[];
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

export interface PerformanceStats {
  greenCount: number;
  yellowCount: number;
  redCount: number;
  totalStudents: number;
  greenPct: number;
  yellowPct: number;
  redPct: number;
  subjectAverages: Array<{ subject: string; avgScore: number }>;
}

export interface DatabaseSchema {
  tenants: Tenant[];
  units: Unit[];
  members: Member[];
  attendance: Attendance[];
  inventory: InventoryItem[];
  financials: FinancialRecord[];
  student_portals?: StudentPortal[];
  broadcasts?: BroadcastMessage[];
}
