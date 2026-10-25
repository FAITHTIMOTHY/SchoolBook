import { UserRole } from '@prisma/client';

export const SUBJECT_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
  UserRole.ACCOUNTANT,
];

export const SUBJECT_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export const SUBJECT_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];
