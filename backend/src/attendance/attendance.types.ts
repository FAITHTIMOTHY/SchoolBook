import type {
  AttendanceSessionStatus,
  AttendanceStatus,
  UserRole,
} from '@prisma/client';

export interface AttendanceActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
}

export interface AttendanceClassroomSummary {
  id: string;
  name: string;
  code: string | null;
}

export interface AttendanceTermSummary {
  id: string;
  name: string;
}

export interface AttendanceSubjectSummary {
  id: string;
  name: string;
  code: string;
}

export interface AttendanceStaffSummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface AttendanceSessionSummary {
  id: string;
  tenantId: string;
  classroomId: string;
  termId: string;
  subjectId: string | null;
  period: string;
  date: string;
  status: AttendanceSessionStatus;
  takenById: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  classroom: AttendanceClassroomSummary;
  term: AttendanceTermSummary;
  subject: AttendanceSubjectSummary | null;
  takenBy: AttendanceStaffSummary | null;
  recordCount: number;
}

export interface AttendanceStudentSummary {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
}

export interface AttendanceRecordSummary {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  student: AttendanceStudentSummary;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  holiday: number;
}

export interface AttendanceSessionDetail extends AttendanceSessionSummary {
  records: AttendanceRecordSummary[];
  summary: AttendanceSummary;
}

export interface AttendanceRosterEntry {
  student: AttendanceStudentSummary;
  recordId: string | null;
  status: AttendanceStatus | null;
  remarks: string | null;
}

export interface ListAttendanceSessionsQuery {
  classroomId?: string;
  termId?: string;
  subjectId?: string;
  status?: AttendanceSessionStatus;
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'date' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedAttendanceSessions {
  data: AttendanceSessionSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateAttendanceSessionInput {
  classroomId: string;
  termId: string;
  subjectId?: string | null;
  period?: string;
  date: string;
  takenById?: string | null;
  notes?: string | null;
}

export interface UpdateAttendanceSessionInput {
  classroomId?: string;
  termId?: string;
  subjectId?: string | null;
  period?: string;
  date?: string;
  takenById?: string | null;
  notes?: string | null;
}

export interface AttendanceRecordInput {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string | null;
}

export interface SaveAttendanceRecordsInput {
  records: AttendanceRecordInput[];
}

export interface UpdateAttendanceRecordInput {
  status?: AttendanceStatus;
  remarks?: string | null;
}
