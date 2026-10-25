import { TermStatus } from '@prisma/client';

export interface TermActorContext {
  id: string;
  tenantId: string;
  role: string;
  email: string;
}

export interface TermSummary {
  id: string;
  tenantId: string;
  name: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  status: TermStatus;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  academicYear: {
    id: string;
    name: string;
  };
}

export interface PaginatedTerms {
  data: TermSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateTermInput {
  name: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  status?: TermStatus;
  isCurrent?: boolean;
}

export interface UpdateTermInput {
  name?: string;
  academicYearId?: string;
  startDate?: string;
  endDate?: string;
  status?: TermStatus;
  isCurrent?: boolean;
}

export interface ListTermsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  academicYearId?: string;
  status?: TermStatus;
  isCurrent?: boolean;
  sortBy?: 'name' | 'startDate' | 'endDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
