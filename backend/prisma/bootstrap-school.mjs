import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const required = [
  'DATABASE_URL',
  'BOOTSTRAP_SCHOOL_NAME',
  'BOOTSTRAP_SCHOOL_SLUG',
  'BOOTSTRAP_PRINCIPAL_EMAIL',
  'BOOTSTRAP_PRINCIPAL_PASSWORD',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is required.`);
  }
}

const slug = process.env.BOOTSTRAP_SCHOOL_SLUG.trim().toLowerCase();
if (!/^[a-z0-9-]+$/.test(slug)) {
  throw new Error('BOOTSTRAP_SCHOOL_SLUG must contain only lowercase letters, numbers, and hyphens.');
}

const password = process.env.BOOTSTRAP_PRINCIPAL_PASSWORD;
if (password.length < 12) {
  throw new Error('BOOTSTRAP_PRINCIPAL_PASSWORD must be at least 12 characters.');
}

const email = process.env.BOOTSTRAP_PRINCIPAL_EMAIL.trim().toLowerCase();
const firstName = (process.env.BOOTSTRAP_PRINCIPAL_FIRST_NAME || 'School').trim();
const lastName = (process.env.BOOTSTRAP_PRINCIPAL_LAST_NAME || 'Principal').trim();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const existingSchool = await prisma.school.findUnique({ where: { slug } });
  if (existingSchool) {
    throw new Error(`A school with slug "${slug}" already exists. This bootstrap script refuses to overwrite it.`);
  }

  const existingUser = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    throw new Error(`A user with email "${email}" already exists.`);
  }

  const passwordHash = await argon2.hash(password);

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: process.env.BOOTSTRAP_SCHOOL_NAME.trim(),
        slug,
        email,
        isActive: true,
      },
    });

    const academicYear = await tx.academicYear.create({
      data: {
        tenantId: school.id,
        name: '2026/2027',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2027-07-31T00:00:00.000Z'),
        status: 'ACTIVE',
        isCurrent: true,
      },
    });

    await tx.term.createMany({
      data: [
        {
          tenantId: school.id,
          academicYearId: academicYear.id,
          name: 'Term 1',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-12-18T00:00:00.000Z'),
          status: 'ACTIVE',
          isCurrent: true,
        },
        {
          tenantId: school.id,
          academicYearId: academicYear.id,
          name: 'Term 2',
          startDate: new Date('2027-01-05T00:00:00.000Z'),
          endDate: new Date('2027-03-31T00:00:00.000Z'),
          status: 'UPCOMING',
          isCurrent: false,
        },
        {
          tenantId: school.id,
          academicYearId: academicYear.id,
          name: 'Term 3',
          startDate: new Date('2027-04-12T00:00:00.000Z'),
          endDate: new Date('2027-07-31T00:00:00.000Z'),
          status: 'UPCOMING',
          isCurrent: false,
        },
      ],
    });

    await tx.department.createMany({
      data: [
        { tenantId: school.id, name: 'Administration', code: 'ADMIN' },
        { tenantId: school.id, name: 'Faculty', code: 'FACULTY' },
        { tenantId: school.id, name: 'Finance', code: 'FIN' },
      ],
    });

    await tx.classroom.create({
      data: {
        tenantId: school.id,
        academicYearId: academicYear.id,
        name: 'General Class',
        code: 'GEN',
      },
    });

    const principal = await tx.user.create({
      data: {
        tenantId: school.id,
        email,
        passwordHash,
        firstName,
        lastName,
        role: 'PRINCIPAL',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true, role: true },
    });

    return { school, principal };
  });

  console.log('BOOTSTRAP_COMPLETE');
  console.log(`  school:    ${result.school.name} (${result.school.slug})`);
  console.log(`  principal: ${result.principal.email} (${result.principal.role})`);
  console.log('  Sign in at /login with the email and password from the environment.');
  console.log('  The password is not printed. Store it in a password manager.');
} finally {
  await prisma.$disconnect();
}
