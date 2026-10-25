import { EmploymentType, Gender, StaffStatus, UserRole } from '@prisma/client';

export interface StaffActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface StaffSummary {
  id: string;
  tenantId: string;
  userId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  hireDate: string;
  employmentType: EmploymentType;
  status: StaffStatus;
  jobTitle: string | null;
  qualification: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
  department: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  user: {
    id: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  } | null;
  headedDepartment: {
    id: string;
    name: string;
    code: string | null;
  } | null;
}

export interface StaffDetail extends StaffSummary {
  // Extended fields same as summary for now
}

export interface PaginatedStaff {
  data: StaffSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateStaffInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  hireDate: string;
  employmentType?: EmploymentType;
  status?: StaffStatus;
  jobTitle?: string | null;
  qualification?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  departmentId?: string | null;
  userId?: string | null;
}

export interface UpdateStaffInput {
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  hireDate?: string;
  employmentType?: EmploymentType;
  status?: StaffStatus;
  jobTitle?: string | null;
  qualification?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  departmentId?: string | null;
  userId?: string | null;
}

export interface ListStaffQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  status?: StaffStatus;
  employmentType?: EmploymentType;
  sortBy?: 'firstName' | 'lastName' | 'employeeNumber' | 'hireDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface LinkUserInput {
  userId: string;
}
