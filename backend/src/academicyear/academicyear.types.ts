import { AcademicYearStatus } from '@prisma/client';

export interface AcademicYearActorContext {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

export interface AcademicYearSummary {
  id: string;
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    terms: number;
    classrooms: number;
    enrollments: number;
  };
}

export interface PaginatedAcademicYears {
  data: AcademicYearSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateAcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
  status?: AcademicYearStatus;
  isCurrent?: boolean;
}

export interface UpdateAcademicYearInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: AcademicYearStatus;
  isCurrent?: boolean;
}

export interface ListAcademicYearsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AcademicYearStatus;
  isCurrent?: boolean;
  sortBy?: 'name' | 'startDate' | 'endDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
