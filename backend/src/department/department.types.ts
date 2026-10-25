import { UserRole } from '@prisma/client';

export interface DepartmentActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface DepartmentSummary {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  description: string | null;
  headId: string | null;
  createdAt: string;
  updatedAt: string;
  head: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    email: string | null;
  } | null;
  _count: {
    staff: number;
    subjects: number;
  };
}

export interface PaginatedDepartments {
  data: DepartmentSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateDepartmentInput {
  name: string;
  code?: string | null;
  description?: string | null;
  headId?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  headId?: string | null;
}

export interface ListDepartmentsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
