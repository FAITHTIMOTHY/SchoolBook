import type {
  EnrollmentStatus,
  Gender,
  GuardianRelationship,
  StudentStatus,
  UserRole,
} from '@prisma/client';

export interface StudentActorContext {
  id: string;
  tenantId: string;
  role: UserRole;
}

export interface StudentSummary {
  id: string;
  tenantId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  admissionDate: string;
  status: StudentStatus;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentUserLink {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface StudentGuardianProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  occupation: string | null;
  address: string | null;
}

export interface StudentGuardianLink {
  id: string;
  relationship: GuardianRelationship;
  isPrimary: boolean;
  createdAt: string;
  guardian: StudentGuardianProfile;
}

export interface StudentClassroomSummary {
  id: string;
  name: string;
  code: string | null;
  gradeLevel: number | null;
  section: string | null;
}

export interface StudentAcademicYearSummary {
  id: string;
  name: string;
}

export interface StudentEnrollmentSummary {
  id: string;
  status: EnrollmentStatus;
  enrollmentDate: string;
  classroom: StudentClassroomSummary;
  academicYear: StudentAcademicYearSummary;
}

export interface StudentProfile extends StudentSummary {
  address: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  notes: string | null;
  user: StudentUserLink | null;
  guardians: StudentGuardianLink[];
  currentEnrollment: StudentEnrollmentSummary | null;
}

export interface ListStudentsQuery {
  search?: string;
  status?: StudentStatus;
  gender?: Gender;
  classroomId?: string;
  academicYearId?: string;
  page?: number;
  pageSize?: number;
  sortBy?:
    | 'createdAt'
    | 'admissionDate'
    | 'admissionNumber'
    | 'firstName'
    | 'lastName';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedStudents {
  data: StudentSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateStudentInput {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  admissionDate: string;
  status?: StudentStatus;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  notes?: string | null;
  userId?: string | null;
}

export interface UpdateStudentInput {
  admissionNumber?: string;
  firstName?: string;
  lastName?: string;
  otherNames?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  admissionDate?: string;
  status?: StudentStatus;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  notes?: string | null;
  userId?: string | null;
}

export interface LinkGuardianInput {
  guardianId: string;
  relationship: GuardianRelationship;
  isPrimary?: boolean;
}
