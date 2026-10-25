import { UserRole } from '@prisma/client';

export const STAFF_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.ACCOUNTANT,
  UserRole.TEACHER,
];

export const STAFF_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export const STAFF_CREATORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
];

export const STAFF_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];
