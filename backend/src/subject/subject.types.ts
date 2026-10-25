import { UserRole } from '@prisma/client';

export interface SubjectActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface SubjectSummary {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string | null;
  credits: number | null;
  isCore: boolean;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
  department: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  _count: {
    classSubjects: number;
    timetableEntries: number;
    exams: number;
  };
}

export interface PaginatedSubjects {
  data: SubjectSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSubjectInput {
  name: string;
  code: string;
  description?: string | null;
  credits?: number | null;
  isCore?: boolean;
  departmentId?: string | null;
}

export interface UpdateSubjectInput {
  name?: string;
  code?: string;
  description?: string | null;
  credits?: number | null;
  isCore?: boolean;
  departmentId?: string | null;
}

export interface ListSubjectsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  isCore?: boolean;
  sortBy?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
