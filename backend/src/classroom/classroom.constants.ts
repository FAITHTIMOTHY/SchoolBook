import { UserRole } from '@prisma/client';

export const CLASSROOM_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
  UserRole.ACCOUNTANT,
];

export const CLASSROOM_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export const CLASSROOM_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];
