import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

/**
 * Bootstrap seed — creates the first school and its super admin.
 *
 * Safe to re-run: an existing admin keeps their password. In production,
 * SEED_ADMIN_PASSWORD is required (no password is generated or printed).
 */

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DIRECT_URL or DATABASE_URL must be set.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const slug = (process.env.SEED_SCHOOL_SLUG ?? 'schoolbook').trim().toLowerCase();
const schoolName = (process.env.SEED_SCHOOL_NAME ?? 'SchoolBook Academy').trim();
const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@schoolbook.test')
  .trim()
  .toLowerCase();
const isProduction = process.env.NODE_ENV === 'production';

let password = process.env.SEED_ADMIN_PASSWORD;
let generatedPassword = false;

if (!password) {
  if (isProduction) {
    console.error(
      'SEED_ADMIN_PASSWORD is required when NODE_ENV=production. Refusing to generate a password in production.',
    );
    process.exit(1);
  }

  password = randomBytes(18).toString('base64url');
  generatedPassword = true;
}

if (password.length < 12) {
  console.error('SEED_ADMIN_PASSWORD must be at least 12 characters long.');
  process.exit(1);
}

try {
  const school = await prisma.school.upsert({
    where: { slug },
    update: { name: schoolName },
    create: {
      name: schoolName,
      slug,
      email: process.env.SEED_SCHOOL_EMAIL?.trim() || null,
      phone: process.env.SEED_SCHOOL_PHONE?.trim() || null,
      address: process.env.SEED_SCHOOL_ADDRESS?.trim() || null,
    },
  });

  const existing = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: school.id,
        email: adminEmail,
      },
    },
  });

  let passwordApplied = false;
  let userId;

  if (existing) {
    const data = {
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
    };

    if (!existing.passwordHash) {
      data.passwordHash = await argon2.hash(password);
      passwordApplied = true;
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data,
    });
    userId = updated.id;
  } else {
    const created = await prisma.user.create({
      data: {
        tenantId: school.id,
        email: adminEmail,
        passwordHash: await argon2.hash(password),
        firstName: process.env.SEED_ADMIN_FIRST_NAME?.trim() || 'System',
        lastName: process.env.SEED_ADMIN_LAST_NAME?.trim() || 'Administrator',
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    userId = created.id;
    passwordApplied = true;
  }

  console.log('');
  console.log('Bootstrap complete');
  console.log(`  School:   ${school.name} (slug: ${school.slug})`);
  console.log(`  Admin:    ${adminEmail} (id: ${userId})`);
  console.log(`  Login:    POST /auth/login { tenantSlug, email, password }`);
  console.log('');

  if (generatedPassword && passwordApplied) {
    console.log(`  Generated password (store it now, it will not be shown again):`);
    console.log(`  ${password}`);
    console.log('');
  } else if (existing) {
    console.log(
      '  Admin already existed; password left unchanged. Set SEED_ADMIN_PASSWORD and remove the user to reset it.',
    );
    console.log('');
  }
} finally {
  await prisma.$disconnect();
}
