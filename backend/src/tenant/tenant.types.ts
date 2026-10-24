export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  website: string | null;
  motto: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantCounts {
  students: number;
  activeStudents: number;
  staff: number;
  activeStaff: number;
  users: number;
  classrooms: number;
  departments: number;
  attendanceSessions: number;
  pendingInvoices: number;
}

export interface TenantOverview {
  tenantId: string;
  counts: TenantCounts;
  generatedAt: string;
}
