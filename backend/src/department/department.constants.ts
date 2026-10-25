import { UserRole } from '@prisma/client';

export const DEPARTMENT_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
  UserRole.ACCOUNTANT,
];

export const DEPARTMENT_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export const DEPARTMENT_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];
