import { UserRole } from '@prisma/client';

export const ACADEMICYEAR_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
  UserRole.ACCOUNTANT,
];

export const ACADEMICYEAR_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export const ACADEMICYEAR_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];

export const TERM_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
  UserRole.ACCOUNTANT,
];

export const TERM_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export const TERM_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];
