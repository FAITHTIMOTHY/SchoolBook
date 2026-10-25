import { UserRole } from '@prisma/client';

export interface ClassroomActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface ClassroomSummary {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  gradeLevel: number | null;
  section: string | null;
  capacity: number | null;
  room: string | null;
  academicYearId: string;
  classTeacherId: string | null;
  createdAt: string;
  updatedAt: string;
  academicYear: {
    id: string;
    name: string;
    status: string;
  };
  classTeacher: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  } | null;
  _count: {
    enrollments: number;
    classSubjects: number;
    timetableEntries: number;
  };
}

export interface ClassroomDetail extends ClassroomSummary {
  enrollments?: any[];
  classSubjects?: any[];
}

export interface PaginatedClassrooms {
  data: ClassroomSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateClassroomInput {
  name: string;
  code?: string | null;
  gradeLevel?: number | null;
  section?: string | null;
  capacity?: number | null;
  room?: string | null;
  academicYearId: string;
  classTeacherId?: string | null;
}

export interface UpdateClassroomInput {
  name?: string;
  code?: string | null;
  gradeLevel?: number | null;
  section?: string | null;
  capacity?: number | null;
  room?: string | null;
  academicYearId?: string;
  classTeacherId?: string | null;
}

export interface ListClassroomsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  academicYearId?: string;
  classTeacherId?: string;
  gradeLevel?: number;
  sortBy?: 'name' | 'gradeLevel' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
