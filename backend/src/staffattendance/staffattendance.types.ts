import { AttendanceStatus, DayOfWeek, UserRole } from '@prisma/client';

export interface StaffAttendanceActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface StaffAttendanceSummary {
  id: string;
  tenantId: string;
  staffId: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobTitle: string | null;
    departmentId: string | null;
  };
}

export interface PaginatedStaffAttendance {
  data: StaffAttendanceSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateStaffAttendanceInput {
  staffId: string;
  date: string;
  status?: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  remarks?: string | null;
}

export interface UpdateStaffAttendanceInput {
  status?: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  remarks?: string | null;
}

export interface BulkStaffAttendanceInput {
  records: Array<{
    staffId: string;
    status: AttendanceStatus;
    checkIn?: string | null;
    checkOut?: string | null;
    remarks?: string | null;
  }>;
  date: string;
}

export interface ListStaffAttendanceQuery {
  page?: number;
  pageSize?: number;
  staffId?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: AttendanceStatus;
  sortBy?: 'date' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TimetableActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface TimetableSummary {
  id: string;
  tenantId: string;
  classroomId: string;
  subjectId: string;
  teacherId: string | null;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string | null;
  createdAt: string;
  updatedAt: string;
  classroom: {
    id: string;
    name: string;
    code: string | null;
    gradeLevel: number | null;
  };
  subject: {
    id: string;
    name: string;
    code: string;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  } | null;
}

export interface PaginatedTimetable {
  data: TimetableSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateTimetableInput {
  classroomId: string;
  subjectId: string;
  teacherId?: string | null;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | null;
}

export interface UpdateTimetableInput {
  classroomId?: string;
  subjectId?: string;
  teacherId?: string | null;
  dayOfWeek?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  room?: string | null;
}

export interface ListTimetableQuery {
  page?: number;
  pageSize?: number;
  classroomId?: string;
  subjectId?: string;
  teacherId?: string;
  dayOfWeek?: DayOfWeek;
  sortBy?: 'dayOfWeek' | 'startTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
