import { UserRole } from '@prisma/client';

export const STAFF_ATTENDANCE_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.ACCOUNTANT,
];

export const STAFF_ATTENDANCE_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
];

export const STAFF_ATTENDANCE_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];

export const TIMETABLE_READERS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.TEACHER,
  UserRole.ACCOUNTANT,
];

export const TIMETABLE_EDITORS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
];

export const TIMETABLE_ADMINS = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];
