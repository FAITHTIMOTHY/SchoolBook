import type { UserRole } from '@prisma/client';

export interface UserActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
}

export interface LinkedStaffProfile {
  id: string;
  employeeNumber: string;
}

export interface LinkedStudentProfile {
  id: string;
  admissionNumber: string;
}

export interface LinkedGuardianProfile {
  id: string;
  phone: string;
}

export interface UserProfile {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  staff: LinkedStaffProfile | null;
  student: LinkedStudentProfile | null;
  guardian: LinkedGuardianProfile | null;
}

export interface ListUsersQuery {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'lastLoginAt' | 'firstName' | 'lastName' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedUsers {
  data: UserProfile[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  phone?: string | null;
  avatarUrl?: string | null;
  password?: string;
  isActive?: boolean;
  staffId?: string;
  studentId?: string;
  guardianId?: string;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: UserRole;
}

export interface UpdateOwnProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}
