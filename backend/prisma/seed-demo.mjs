import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';

/**
 * Demo data seed — realistic academic, attendance, finance, inventory and
 * communication records for UI review and end-to-end testing.
 *
 * This script is opt-in. It refuses to run unless SEED_DEMO_DATA=true, so a
 * production deployment can never seed fake students by accident.
 *
 * Usage (local/staging only):
 *   SEED_DEMO_DATA=true node prisma/seed-demo.mjs
 *
 * Re-running is safe: every record is upserted by a natural or deterministic
 * key. Existing accounts keep their passwords.
 */

if (process.env.SEED_DEMO_DATA !== 'true') {
  console.log('SEED_DEMO_DATA is not "true". Skipping demo seed.');
  process.exit(0);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DIRECT_URL or DATABASE_URL must be set.');
  process.exit(1);
}

const slug = (process.env.SEED_SCHOOL_SLUG ?? 'schoolbook').trim().toLowerCase();
const isProduction = process.env.NODE_ENV === 'production';
const demoPassword =
  process.env.SEED_DEMO_PASSWORD ?? 'SchoolBookDemo!2026';

if (isProduction && !process.env.SEED_DEMO_PASSWORD) {
  console.error(
    'SEED_DEMO_PASSWORD is required when seeding demo data with NODE_ENV=production.',
  );
  process.exit(1);
}

if (demoPassword.length < 12) {
  console.error('SEED_DEMO_PASSWORD must be at least 12 characters long.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const dateOnly = (value) => new Date(`${value}T00:00:00.000Z`);

const utcDay = (offsetDays = 0) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
};

const isoDay = (date) => date.toISOString().slice(0, 10);

const DEMO_HASH = await argon2.hash(demoPassword);

const DEPARTMENTS = [
  {
    name: 'Administration',
    code: 'ADMIN',
    description: 'School leadership, operations and campus administration.',
  },
  {
    name: 'Sciences',
    code: 'SCI',
    description: 'Mathematics, natural sciences and technology.',
  },
  {
    name: 'Humanities',
    code: 'HUM',
    description: 'Languages, literature, social sciences and the library.',
  },
  {
    name: 'Student Affairs',
    code: 'SSA',
    description: 'Counseling, wellbeing and student life.',
  },
  {
    name: 'Finance',
    code: 'FIN',
    description: 'Bursary, fees and financial operations.',
  },
];

const STAFF = [
  {
    email: 'principal@schoolbook.test',
    firstName: 'Adaeze',
    lastName: 'Nwosu',
    role: 'PRINCIPAL',
    jobTitle: 'Principal',
    department: 'Administration',
    employeeNumber: 'SBA-EMP-001',
    gender: 'FEMALE',
    hireDate: '2018-08-15',
    qualification: 'M.Ed. Educational Leadership',
    phone: '+234 801 000 1001',
    dateOfBirth: '1981-04-12',
  },
  {
    email: 'vice.principal@schoolbook.test',
    firstName: 'Samuel',
    lastName: 'Bennett',
    role: 'VICE_PRINCIPAL',
    jobTitle: 'Vice Principal, Academics',
    department: 'Administration',
    employeeNumber: 'SBA-EMP-002',
    gender: 'MALE',
    hireDate: '2019-01-07',
    qualification: 'M.Ed. Curriculum Studies',
    phone: '+234 801 000 1002',
    dateOfBirth: '1983-11-03',
  },
  {
    email: 'teacher@schoolbook.test',
    firstName: 'Amina',
    lastName: 'Okafor',
    role: 'TEACHER',
    jobTitle: 'Mathematics Teacher',
    department: 'Sciences',
    employeeNumber: 'SBA-EMP-003',
    gender: 'FEMALE',
    hireDate: '2020-09-01',
    qualification: 'B.Sc. Mathematics, PGDE',
    phone: '+234 801 000 1003',
    dateOfBirth: '1990-06-21',
    classTeacherOf: 'Grade 10A',
  },
  {
    email: 'science.teacher@schoolbook.test',
    firstName: 'Daniel',
    lastName: 'Mensah',
    role: 'TEACHER',
    jobTitle: 'Science Teacher',
    department: 'Sciences',
    employeeNumber: 'SBA-EMP-004',
    gender: 'MALE',
    hireDate: '2021-01-11',
    qualification: 'B.Sc. Biology',
    phone: '+234 801 000 1004',
    dateOfBirth: '1988-09-14',
    classTeacherOf: 'Grade 11A',
  },
  {
    email: 'humanities.teacher@schoolbook.test',
    firstName: 'Grace',
    lastName: 'Adeyemi',
    role: 'TEACHER',
    jobTitle: 'English Teacher',
    department: 'Humanities',
    employeeNumber: 'SBA-EMP-005',
    gender: 'FEMALE',
    hireDate: '2019-09-02',
    qualification: 'B.A. English, M.Ed.',
    phone: '+234 801 000 1005',
    dateOfBirth: '1986-02-08',
    classTeacherOf: 'Grade 12A',
  },
  {
    email: 'counselor@schoolbook.test',
    firstName: 'Naomi',
    lastName: 'Eze',
    role: 'TEACHER',
    jobTitle: 'Guidance Counselor',
    department: 'Student Affairs',
    employeeNumber: 'SBA-EMP-006',
    gender: 'FEMALE',
    hireDate: '2020-02-17',
    qualification: 'M.Sc. Counseling Psychology',
    phone: '+234 801 000 1006',
    dateOfBirth: '1989-12-30',
    classTeacherOf: 'Grade 9A',
  },
  {
    email: 'bursar@schoolbook.test',
    firstName: 'Peter',
    lastName: 'Adebayo',
    role: 'ACCOUNTANT',
    jobTitle: 'Bursar',
    department: 'Finance',
    employeeNumber: 'SBA-EMP-007',
    gender: 'MALE',
    hireDate: '2017-05-22',
    qualification: 'B.Sc. Accounting, ICAN',
    phone: '+234 801 000 1007',
    dateOfBirth: '1979-07-19',
  },
  {
    email: 'librarian@schoolbook.test',
    firstName: 'Halima',
    lastName: 'Yusuf',
    role: 'LIBRARIAN',
    jobTitle: 'Librarian',
    department: 'Humanities',
    employeeNumber: 'SBA-EMP-008',
    gender: 'FEMALE',
    hireDate: '2022-08-29',
    qualification: 'MLIS',
    phone: '+234 801 000 1008',
    dateOfBirth: '1992-03-05',
  },
  {
    email: 'ict.teacher@schoolbook.test',
    firstName: 'Tunde',
    lastName: 'Balogun',
    role: 'TEACHER',
    jobTitle: 'Computer Science Teacher',
    department: 'Sciences',
    employeeNumber: 'SBA-EMP-009',
    gender: 'MALE',
    hireDate: '2021-09-06',
    qualification: 'B.Sc. Computer Science',
    phone: '+234 801 000 1009',
    dateOfBirth: '1991-10-11',
    classTeacherOf: 'Grade 8A',
  },
  {
    email: 'arts.teacher@schoolbook.test',
    firstName: 'Chiamaka',
    lastName: 'Obi',
    role: 'TEACHER',
    jobTitle: 'Literature & Arts Teacher',
    department: 'Humanities',
    employeeNumber: 'SBA-EMP-010',
    gender: 'FEMALE',
    hireDate: '2022-01-10',
    qualification: 'B.A. Literature',
    phone: '+234 801 000 1010',
    dateOfBirth: '1993-05-27',
    classTeacherOf: 'Grade 7A',
  },
];

const CLASSROOMS = [
  {
    name: 'Grade 7A',
    code: 'G7A',
    gradeLevel: 7,
    section: 'A',
    capacity: 40,
    room: 'A-103',
    teacherEmail: 'arts.teacher@schoolbook.test',
  },
  {
    name: 'Grade 8A',
    code: 'G8A',
    gradeLevel: 8,
    section: 'A',
    capacity: 40,
    room: 'A-102',
    teacherEmail: 'ict.teacher@schoolbook.test',
  },
  {
    name: 'Grade 9A',
    code: 'G9A',
    gradeLevel: 9,
    section: 'A',
    capacity: 38,
    room: 'A-101',
    teacherEmail: 'counselor@schoolbook.test',
  },
  {
    name: 'Grade 10A',
    code: 'G10A',
    gradeLevel: 10,
    section: 'A',
    capacity: 36,
    room: 'B-201',
    teacherEmail: 'teacher@schoolbook.test',
  },
  {
    name: 'Grade 11A',
    code: 'G11A',
    gradeLevel: 11,
    section: 'A',
    capacity: 34,
    room: 'B-202',
    teacherEmail: 'science.teacher@schoolbook.test',
  },
  {
    name: 'Grade 12A',
    code: 'G12A',
    gradeLevel: 12,
    section: 'A',
    capacity: 32,
    room: 'B-301',
    teacherEmail: 'humanities.teacher@schoolbook.test',
  },
];

const SUBJECTS = [
  {
    name: 'Mathematics',
    code: 'MATH',
    department: 'Sciences',
    teacherEmail: 'teacher@schoolbook.test',
    isCore: true,
    credits: 5,
  },
  {
    name: 'English Language',
    code: 'ENG',
    department: 'Humanities',
    teacherEmail: 'humanities.teacher@schoolbook.test',
    isCore: true,
    credits: 5,
  },
  {
    name: 'Biology',
    code: 'BIO',
    department: 'Sciences',
    teacherEmail: 'science.teacher@schoolbook.test',
    isCore: true,
    credits: 4,
  },
  {
    name: 'Chemistry',
    code: 'CHEM',
    department: 'Sciences',
    teacherEmail: 'science.teacher@schoolbook.test',
    isCore: true,
    credits: 4,
  },
  {
    name: 'Physics',
    code: 'PHY',
    department: 'Sciences',
    teacherEmail: 'science.teacher@schoolbook.test',
    isCore: true,
    credits: 4,
  },
  {
    name: 'History',
    code: 'HIST',
    department: 'Humanities',
    teacherEmail: 'humanities.teacher@schoolbook.test',
    isCore: true,
    credits: 3,
  },
  {
    name: 'Geography',
    code: 'GEO',
    department: 'Humanities',
    teacherEmail: 'humanities.teacher@schoolbook.test',
    isCore: true,
    credits: 3,
  },
  {
    name: 'Computer Science',
    code: 'CS',
    department: 'Sciences',
    teacherEmail: 'ict.teacher@schoolbook.test',
    isCore: true,
    credits: 4,
  },
  {
    name: 'Literature in English',
    code: 'LIT',
    department: 'Humanities',
    teacherEmail: 'arts.teacher@schoolbook.test',
    isCore: true,
    credits: 3,
  },
  {
    name: 'Physical Education',
    code: 'PE',
    department: 'Student Affairs',
    teacherEmail: 'counselor@schoolbook.test',
    isCore: false,
    credits: 2,
  },
];

const STUDENTS = [
  ['Zainab', 'Bello', 'FEMALE', '2014-03-11', 'Bello', 'FATHER'],
  ['Ethan', 'Cole', 'MALE', '2014-07-02', 'Cole', 'MOTHER'],
  ['Fatima', 'Sule', 'FEMALE', '2014-01-19', 'Sule', 'FATHER'],
  ['Noah', 'Adeyinka', 'MALE', '2014-11-23', 'Adeyinka', 'MOTHER'],
  ['Lily', 'Chen', 'FEMALE', '2014-05-08', 'Chen', 'FATHER'],
  ['Ibrahim', 'Musa', 'MALE', '2013-02-14', 'Musa', 'FATHER'],
  ['Sophia', 'Mensah', 'FEMALE', '2013-09-30', 'Mensah', 'MOTHER'],
  ['David', 'Okoro', 'MALE', '2013-06-06', 'Okoro', 'FATHER'],
  ['Aisha', 'Lawal', 'FEMALE', '2013-12-17', 'Lawal', 'MOTHER'],
  ['Caleb', 'Nwankwo', 'MALE', '2013-04-25', 'Nwankwo', 'FATHER'],
  ['Maya', 'Patel', 'FEMALE', '2012-08-03', 'Patel', 'MOTHER'],
  ['Samuel', 'Eze', 'MALE', '2012-01-27', 'Eze', 'FATHER'],
  ['Hannah', 'Adeleke', 'FEMALE', '2012-10-09', 'Adeleke', 'MOTHER'],
  ['Josiah', 'Osei', 'MALE', '2012-05-15', 'Osei', 'FATHER'],
  ['Amara', 'Diallo', 'FEMALE', '2012-03-22', 'Diallo', 'MOTHER'],
  ['Benjamin', 'Kim', 'MALE', '2011-07-12', 'Kim', 'FATHER'],
  ['Nia', 'Williams', 'FEMALE', '2011-11-28', 'Williams', 'MOTHER'],
  ['Elijah', 'Bello', 'MALE', '2011-02-05', 'Bello', 'FATHER'],
  ['Chloe', 'Adams', 'FEMALE', '2011-09-18', 'Adams', 'MOTHER'],
  ['Omar', 'Farouk', 'MALE', '2011-04-07', 'Farouk', 'FATHER'],
  ['Isabella', 'Rossi', 'FEMALE', '2010-06-24', 'Rossi', 'MOTHER'],
  ['Kwame', 'Asante', 'MALE', '2010-12-01', 'Asante', 'FATHER'],
  ['Layla', 'Hassan', 'FEMALE', '2010-08-16', 'Hassan', 'MOTHER'],
  ['Michael', 'Chen', 'MALE', '2010-03-29', 'Chen', 'FATHER'],
  ['Grace', 'Mwangi', 'FEMALE', '2010-10-20', 'Mwangi', 'MOTHER'],
  ['Daniel', 'Okafor', 'MALE', '2009-05-13', 'Okafor', 'FATHER'],
  ['Sarah', 'Bello', 'FEMALE', '2009-01-08', 'Bello', 'MOTHER'],
  ['Joshua', 'Adeyemi', 'MALE', '2009-09-04', 'Adeyemi', 'FATHER'],
  ['Zara', 'Khan', 'FEMALE', '2009-11-26', 'Khan', 'MOTHER'],
  ['Nathan', 'Cole', 'MALE', '2009-07-31', 'Cole', 'FATHER'],
];

const GUARDIAN_OCCUPATIONS = [
  'Business Owner',
  'Civil Engineer',
  'Medical Doctor',
  'University Lecturer',
  'Bank Manager',
  'Architect',
  'Pharmacist',
  'Entrepreneur',
  'Accountant',
  'Software Engineer',
];

const PORTAL_SUBJECTS = [
  'Mathematics',
  'English Language',
  'Biology',
  'History',
  'Computer Science',
  'Literature in English',
];

const PORTAL_TEACHERS = {
  Mathematics: 'Amina Okafor',
  'English Language': 'Grace Adeyemi',
  Biology: 'Daniel Mensah',
  History: 'Grace Adeyemi',
  'Computer Science': 'Tunde Balogun',
  'Literature in English': 'Chiamaka Obi',
};

const INVENTORY = [
  ['Dell Latitude 5440 Laptops', '24 staff laptops with docking stations and 3-year warranty.', 'ACTIVE', 'Administration'],
  ['Epson EB-2250U Projectors', 'Ceiling-mounted projectors for the senior block classrooms.', 'ACTIVE', 'Sciences'],
  ['Laboratory Microscopes', 'Binocular microscopes for the biology laboratory.', 'ACTIVE', 'Sciences'],
  ['Chemistry Glassware Sets', 'Borosilicate beakers, flasks and measuring cylinders.', 'ACTIVE', 'Sciences'],
  ['Library Reference Atlases', 'World atlases and reference encyclopedias for the library.', 'ACTIVE', 'Humanities'],
  ['Student Chromebooks', 'Shared classroom devices for the ICT programme.', 'ACTIVE', 'Sciences'],
  ['Portable Basketball Hoops', 'Two portable hoops for the outdoor court.', 'FAULTY', 'Student Affairs'],
  ['Staff Room Coffee Machine', 'Bean-to-cup machine in the staff common room.', 'ACTIVE', 'Administration'],
  ['First Aid Kits', 'Wall-mounted first aid kits for every corridor.', 'ACTIVE', 'Student Affairs'],
  ['Fire Extinguishers', 'Serviced extinguishers with annual inspection tags.', 'ACTIVE', 'Administration'],
  ['Smart Boards', 'Interactive displays in the Grade 10–12 classrooms.', 'ACTIVE', 'Sciences'],
  ['Music Room Keyboards', 'Five digital keyboards for the music elective.', 'UNAVAILABLE', 'Humanities'],
];

const FINANCE = [
  ['demo_fin_001', 'TUITION', 3200, 'Bank Transfer', 2, 'Term 1 tuition — Grade 12A'],
  ['demo_fin_002', 'TUITION', 2800, 'Card', 3, 'Term 1 tuition — Grade 11A'],
  ['demo_fin_003', 'LAB_LIBRARY', 350, 'Mobile Money', 4, 'Laboratory and library levy'],
  ['demo_fin_004', 'PTA_EXTRACURRICULAR', 180, 'Cash', 6, 'PTA and extracurricular dues'],
  ['demo_fin_005', 'TUITION', 3100, 'Bank Transfer', 8, 'Term 1 tuition — Grade 10A'],
  ['demo_fin_006', 'DONATIONS', 5000, 'Bank Transfer', 10, 'Alumni endowment — science block'],
  ['demo_fin_007', 'TUITION', 2950, 'Card', 12, 'Term 1 tuition — Grade 9A'],
  ['demo_fin_008', 'LAB_LIBRARY', 420, 'Bank Transfer', 14, 'Science laboratory consumables'],
  ['demo_fin_009', 'PTA_EXTRACURRICULAR', 220, 'Mobile Money', 16, 'Inter-house sports levy'],
  ['demo_fin_010', 'TUITION', 3300, 'Bank Transfer', 18, 'Term 1 tuition — Grade 8A'],
  ['demo_fin_011', 'DONATIONS', 1200, 'Cash', 21, 'Library expansion fund'],
  ['demo_fin_012', 'TUITION', 2700, 'Mobile Money', 24, 'Term 1 tuition — Grade 7A'],
  ['demo_fin_013', 'LAB_LIBRARY', 300, 'Card', 27, 'Computer lab maintenance'],
  ['demo_fin_014', 'PTA_EXTRACURRICULAR', 150, 'Cash', 30, 'PTA meeting refreshments'],
  ['demo_fin_015', 'DONATIONS', 7500, 'Bank Transfer', 34, 'Anonymous scholarship endowment'],
  ['demo_fin_016', 'TUITION', 3050, 'Bank Transfer', 38, 'Term 1 tuition — Grade 12A'],
];

async function main() {
  const school = await prisma.school.findUnique({ where: { slug } });

  if (!school) {
    console.error(
      `School "${slug}" was not found. Run the bootstrap seed first: node prisma/seed.mjs`,
    );
    process.exit(1);
  }

  console.log(`Seeding demo data for ${school.name} (${school.slug})…`);

  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ?? 'admin@schoolbook.test'
  )
    .trim()
    .toLowerCase();

  const admin =
    (await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: school.id, email: adminEmail } },
    })) ??
    (await prisma.user.findFirst({
      where: { tenantId: school.id, role: 'SUPER_ADMIN' },
    }));

  if (!admin) {
    console.error('No administrator account found. Run the bootstrap seed first.');
    process.exit(1);
  }

  // ---------------------------------------------------------------------
  // Academic year and terms
  // ---------------------------------------------------------------------

  const academicYear = await prisma.academicYear.upsert({
    where: {
      tenantId_name: { tenantId: school.id, name: '2026/2027' },
    },
    update: {
      startDate: dateOnly('2026-09-01'),
      endDate: dateOnly('2027-07-31'),
      status: 'ACTIVE',
      isCurrent: true,
    },
    create: {
      tenantId: school.id,
      name: '2026/2027',
      startDate: dateOnly('2026-09-01'),
      endDate: dateOnly('2027-07-31'),
      status: 'ACTIVE',
      isCurrent: true,
    },
  });

  const termDefinitions = [
    {
      name: 'Term 1',
      startDate: '2026-09-01',
      endDate: '2026-12-18',
      status: 'ACTIVE',
      isCurrent: true,
    },
    {
      name: 'Term 2',
      startDate: '2027-01-11',
      endDate: '2027-03-26',
      status: 'UPCOMING',
      isCurrent: false,
    },
    {
      name: 'Term 3',
      startDate: '2027-04-12',
      endDate: '2027-07-16',
      status: 'UPCOMING',
      isCurrent: false,
    },
  ];

  const terms = {};

  for (const definition of termDefinitions) {
    terms[definition.name] = await prisma.term.upsert({
      where: {
        tenantId_academicYearId_name: {
          tenantId: school.id,
          academicYearId: academicYear.id,
          name: definition.name,
        },
      },
      update: {
        startDate: dateOnly(definition.startDate),
        endDate: dateOnly(definition.endDate),
        status: definition.status,
        isCurrent: definition.isCurrent,
      },
      create: {
        tenantId: school.id,
        academicYearId: academicYear.id,
        name: definition.name,
        startDate: dateOnly(definition.startDate),
        endDate: dateOnly(definition.endDate),
        status: definition.status,
        isCurrent: definition.isCurrent,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------

  const departments = {};

  for (const definition of DEPARTMENTS) {
    departments[definition.name] = await prisma.department.upsert({
      where: {
        tenantId_name: { tenantId: school.id, name: definition.name },
      },
      update: {
        code: definition.code,
        description: definition.description,
      },
      create: {
        tenantId: school.id,
        name: definition.name,
        code: definition.code,
        description: definition.description,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Staff and user accounts
  // ---------------------------------------------------------------------

  const staffByEmail = {};

  for (const definition of STAFF) {
    const user = await ensureUser({
      email: definition.email,
      firstName: definition.firstName,
      lastName: definition.lastName,
      role: definition.role,
      phone: definition.phone,
    });

    const staff = await prisma.staff.upsert({
      where: {
        tenantId_employeeNumber: {
          tenantId: school.id,
          employeeNumber: definition.employeeNumber,
        },
      },
      update: {
        userId: user.id,
        firstName: definition.firstName,
        lastName: definition.lastName,
        email: definition.email,
        phone: definition.phone,
        gender: definition.gender,
        dateOfBirth: dateOnly(definition.dateOfBirth),
        hireDate: dateOnly(definition.hireDate),
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        jobTitle: definition.jobTitle,
        qualification: definition.qualification,
        departmentId: departments[definition.department].id,
      },
      create: {
        tenantId: school.id,
        userId: user.id,
        employeeNumber: definition.employeeNumber,
        firstName: definition.firstName,
        lastName: definition.lastName,
        email: definition.email,
        phone: definition.phone,
        gender: definition.gender,
        dateOfBirth: dateOnly(definition.dateOfBirth),
        hireDate: dateOnly(definition.hireDate),
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        jobTitle: definition.jobTitle,
        qualification: definition.qualification,
        departmentId: departments[definition.department].id,
      },
    });

    staffByEmail[definition.email] = { staff, user, definition };
  }

  const principal = staffByEmail['principal@schoolbook.test'];
  const bursar = staffByEmail['bursar@schoolbook.test'];

  // ---------------------------------------------------------------------
  // Classrooms
  // ---------------------------------------------------------------------

  const classrooms = {};

  for (const definition of CLASSROOMS) {
    const classTeacher = staffByEmail[definition.teacherEmail]?.staff ?? null;

    classrooms[definition.name] = await prisma.classroom.upsert({
      where: {
        tenantId_academicYearId_name: {
          tenantId: school.id,
          academicYearId: academicYear.id,
          name: definition.name,
        },
      },
      update: {
        code: definition.code,
        gradeLevel: definition.gradeLevel,
        section: definition.section,
        capacity: definition.capacity,
        room: definition.room,
        classTeacherId: classTeacher?.id ?? null,
      },
      create: {
        tenantId: school.id,
        academicYearId: academicYear.id,
        name: definition.name,
        code: definition.code,
        gradeLevel: definition.gradeLevel,
        section: definition.section,
        capacity: definition.capacity,
        room: definition.room,
        classTeacherId: classTeacher?.id ?? null,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Subjects and class subjects
  // ---------------------------------------------------------------------

  const subjects = {};

  for (const definition of SUBJECTS) {
    subjects[definition.name] = await prisma.subject.upsert({
      where: {
        tenantId_code: { tenantId: school.id, code: definition.code },
      },
      update: {
        name: definition.name,
        departmentId: departments[definition.department].id,
        isCore: definition.isCore,
        credits: definition.credits,
      },
      create: {
        tenantId: school.id,
        name: definition.name,
        code: definition.code,
        departmentId: departments[definition.department].id,
        isCore: definition.isCore,
        credits: definition.credits,
      },
    });
  }

  for (const classroom of Object.values(classrooms)) {
    for (const subjectName of PORTAL_SUBJECTS) {
      const subjectDefinition = SUBJECTS.find(
        (definition) => definition.name === subjectName,
      );

      if (!subjectDefinition) continue;

      const teacher =
        staffByEmail[subjectDefinition.teacherEmail]?.staff ?? null;

      await prisma.classSubject.upsert({
        where: {
          tenantId_classroomId_subjectId: {
            tenantId: school.id,
            classroomId: classroom.id,
            subjectId: subjects[subjectName].id,
          },
        },
        update: { teacherId: teacher?.id ?? null },
        create: {
          tenantId: school.id,
          classroomId: classroom.id,
          subjectId: subjects[subjectName].id,
          teacherId: teacher?.id ?? null,
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // Students, guardians, enrolments and portals
  // ---------------------------------------------------------------------

  const studentRecords = [];

  for (let index = 0; index < STUDENTS.length; index += 1) {
    const [
      firstName,
      lastName,
      gender,
      dateOfBirth,
      guardianLastName,
      relationship,
    ] = STUDENTS[index];

    const classroomDefinition = CLASSROOMS[Math.floor(index / 5)];
    const classroom = classrooms[classroomDefinition.name];
    const sequence = String(index + 1).padStart(3, '0');
    const admissionNumber = `SBA-2026-${sequence}`;
    const email = `student${sequence}@schoolbook.test`;
    const guardianEmail = `guardian${sequence}@schoolbook.test`;
    const guardianFirstName = relationship === 'MOTHER' ? 'Ifeoma' : 'Emeka';
    const guardianName = `${guardianFirstName} ${guardianLastName}`;
    const phone = `+234 803 200 ${String(index + 1).padStart(4, '0')}`;
    const guardianPhone = `+234 802 100 ${String(index + 1).padStart(4, '0')}`;
    const address = `${12 + index} Cedar Avenue, Lagos`;
    const guardianOccupation =
      GUARDIAN_OCCUPATIONS[index % GUARDIAN_OCCUPATIONS.length];

    const user = await ensureUser({
      email,
      firstName,
      lastName,
      role: 'STUDENT',
      phone,
    });

    const student = await prisma.student.upsert({
      where: {
        tenantId_admissionNumber: {
          tenantId: school.id,
          admissionNumber,
        },
      },
      update: {
        userId: user.id,
        firstName,
        lastName,
        gender,
        dateOfBirth: dateOnly(dateOfBirth),
        admissionDate: dateOnly('2026-09-01'),
        status: 'ACTIVE',
        email,
        phone,
        address,
        unitId: classroom.id,
      },
      create: {
        tenantId: school.id,
        userId: user.id,
        admissionNumber,
        firstName,
        lastName,
        gender,
        dateOfBirth: dateOnly(dateOfBirth),
        admissionDate: dateOnly('2026-09-01'),
        status: 'ACTIVE',
        email,
        phone,
        address,
        unitId: classroom.id,
      },
    });

    const guardianUser = await ensureUser({
      email: guardianEmail,
      firstName: guardianFirstName,
      lastName: guardianLastName,
      role: 'PARENT',
      phone: guardianPhone,
    });

    let guardian = await prisma.guardian.findFirst({
      where: { tenantId: school.id, email: guardianEmail },
    });

    if (!guardian) {
      guardian = await prisma.guardian.create({
        data: {
          tenantId: school.id,
          userId: guardianUser.id,
          firstName: guardianFirstName,
          lastName: guardianLastName,
          email: guardianEmail,
          phone: guardianPhone,
          occupation: guardianOccupation,
          address,
        },
      });
    } else if (!guardian.userId) {
      guardian = await prisma.guardian.update({
        where: { id: guardian.id },
        data: { userId: guardianUser.id },
      });
    }

    await prisma.studentGuardian.upsert({
      where: {
        tenantId_studentId_guardianId: {
          tenantId: school.id,
          studentId: student.id,
          guardianId: guardian.id,
        },
      },
      update: {
        relationship,
        isPrimary: true,
      },
      create: {
        tenantId: school.id,
        studentId: student.id,
        guardianId: guardian.id,
        relationship,
        isPrimary: true,
      },
    });

    await prisma.enrollment.upsert({
      where: {
        tenantId_studentId_academicYearId: {
          tenantId: school.id,
          studentId: student.id,
          academicYearId: academicYear.id,
        },
      },
      update: {
        classroomId: classroom.id,
        status: 'ACTIVE',
      },
      create: {
        tenantId: school.id,
        studentId: student.id,
        classroomId: classroom.id,
        academicYearId: academicYear.id,
        enrollmentDate: dateOnly('2026-09-01'),
        status: 'ACTIVE',
        remarks: 'Term 1 enrolment',
      },
    });

    const overallScore = 68 + ((index * 7) % 30);
    const grades = PORTAL_SUBJECTS.map((subject, subjectIndex) => {
      const score = Math.max(
        45,
        Math.min(100, overallScore + ((subjectIndex * 5 + index) % 15) - 7),
      );

      return {
        id: `demo_grade_${sequence}_${subjectIndex + 1}`,
        subject,
        score,
        teacher: PORTAL_TEACHERS[subject],
        term: 'Term 1',
        comments:
          score >= 80
            ? 'Excellent grasp of the curriculum.'
            : score >= 65
              ? 'Good progress; keep practising the exam-style questions.'
              : 'Requires focused revision and weekly check-ins.',
      };
    });

    await prisma.studentPortal.upsert({
      where: {
        tenantId_studentId: {
          tenantId: school.id,
          studentId: student.id,
        },
      },
      update: {
        gradeLevel: classroom.name,
        overallScore,
        term: 'Term 1',
        grades,
        teacherRemarks: `${firstName} is a ${overallScore >= 80 ? 'confident and consistent' : 'steadily improving'} learner. ${
          overallScore >= 80
            ? 'Continue the excellent work in the next term.'
            : 'A structured revision plan will help consolidate the core subjects.'
        }`,
        guardianName,
        guardianEmail,
        guardianPhone,
        guardianRelation: relationship === 'MOTHER' ? 'Mother' : 'Father',
        syllabusAttachments: [
          {
            title: 'Term 1 Curriculum & Assessment Guide',
            filename: `Term-1-Curriculum-${classroom.code}.pdf`,
            uploaded_by: principal
              ? `${principal.staff.firstName} ${principal.staff.lastName}`
              : 'School Administration',
            date: new Date().toISOString(),
          },
        ],
        lastUpdatedById: principal?.user.id ?? admin.id,
      },
      create: {
        tenantId: school.id,
        studentId: student.id,
        gradeLevel: classroom.name,
        overallScore,
        term: 'Term 1',
        grades,
        teacherRemarks: `${firstName} is a ${overallScore >= 80 ? 'confident and consistent' : 'steadily improving'} learner. ${
          overallScore >= 80
            ? 'Continue the excellent work in the next term.'
            : 'A structured revision plan will help consolidate the core subjects.'
        }`,
        guardianName,
        guardianEmail,
        guardianPhone,
        guardianRelation: relationship === 'MOTHER' ? 'Mother' : 'Father',
        syllabusAttachments: [
          {
            title: 'Term 1 Curriculum & Assessment Guide',
            filename: `Term-1-Curriculum-${classroom.code}.pdf`,
            uploaded_by: principal
              ? `${principal.staff.firstName} ${principal.staff.lastName}`
              : 'School Administration',
            date: new Date().toISOString(),
          },
        ],
        lastUpdatedById: principal?.user.id ?? admin.id,
      },
    });

    studentRecords.push({
      student,
      user,
      guardian,
      classroom,
      index,
      admissionNumber,
    });
  }

  // ---------------------------------------------------------------------
  // Attendance: legacy service roll call + academic class registers
  // ---------------------------------------------------------------------

  const serviceDates = [0, 1, 2, 3, 4].map((offset) => utcDay(-offset));
  const recordedById = principal?.user.id ?? admin.id;

  for (const serviceDate of serviceDates) {
    const members = [
      ...studentRecords.map((record, index) => ({
        id: record.student.id,
        kind: 'STUDENT',
        index,
      })),
      ...Object.values(staffByEmail).map((record, index) => ({
        id: record.staff.id,
        kind: 'STAFF',
        index: index + 100,
      })),
      { id: admin.id, kind: 'USER', index: 200 },
    ];

    for (const member of members) {
      const status =
        (member.index + serviceDate.getUTCDate()) % 17 === 0
          ? 'ABSENT'
          : 'PRESENT';

      await prisma.serviceAttendance.upsert({
        where: {
          tenantId_memberId_serviceDate_serviceName: {
            tenantId: school.id,
            memberId: member.id,
            serviceDate,
            serviceName: 'Morning Roll Call',
          },
        },
        update: { status, recordedById },
        create: {
          tenantId: school.id,
          memberId: member.id,
          memberKind: member.kind,
          serviceDate,
          serviceName: 'Morning Roll Call',
          status,
          recordedById,
        },
      });
    }
  }

  const classDates = [0, 1, 2].map((offset) => utcDay(-offset));

  for (const classroom of Object.values(classrooms)) {
    const classStudents = studentRecords.filter(
      (record) => record.classroom.id === classroom.id,
    );
    const classTeacher =
      Object.values(staffByEmail).find(
        (record) => record.definition.classTeacherOf === classroom.name,
      )?.staff ?? null;

    for (const date of classDates) {
      const session = await prisma.attendanceSession.upsert({
        where: {
          tenantId_classroomId_date_period: {
            tenantId: school.id,
            classroomId: classroom.id,
            date,
            period: 'FULL_DAY',
          },
        },
        update: {
          termId: terms['Term 1'].id,
          status: 'SUBMITTED',
          takenById: classTeacher?.id ?? null,
        },
        create: {
          tenantId: school.id,
          classroomId: classroom.id,
          termId: terms['Term 1'].id,
          date,
          period: 'FULL_DAY',
          status: 'SUBMITTED',
          takenById: classTeacher?.id ?? null,
        },
      });

      await prisma.attendanceRecord.createMany({
        data: classStudents.map((record) => {
          const marker = (record.index + date.getUTCDate()) % 23;
          const status =
            marker === 0 ? 'ABSENT' : marker === 1 ? 'LATE' : 'PRESENT';

          return {
            tenantId: school.id,
            sessionId: session.id,
            studentId: record.student.id,
            status,
            remarks:
              status === 'ABSENT'
                ? 'Guardian notified by the class teacher.'
                : status === 'LATE'
                  ? 'Arrived after the register closed.'
                  : null,
          };
        }),
        skipDuplicates: true,
      });
    }
  }

  // ---------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------

  for (let index = 0; index < INVENTORY.length; index += 1) {
    const [itemName, description, status, departmentName] = INVENTORY[index];
    const department = departments[departmentName];

    await prisma.inventoryItem.upsert({
      where: { id: `demo_inv_${String(index + 1).padStart(3, '0')}` },
      update: {
        itemName,
        description,
        status,
        unitId: department.id,
        unitKind: 'DEPARTMENT',
      },
      create: {
        id: `demo_inv_${String(index + 1).padStart(3, '0')}`,
        tenantId: school.id,
        itemName,
        description,
        status,
        unitId: department.id,
        unitKind: 'DEPARTMENT',
      },
    });
  }

  // ---------------------------------------------------------------------
  // Finance ledger
  // ---------------------------------------------------------------------

  for (let index = 0; index < FINANCE.length; index += 1) {
    const [id, category, amount, paymentMethod, daysAgo, note] =
      FINANCE[index];
    const student = studentRecords[index % studentRecords.length];

    await prisma.financeTransaction.upsert({
      where: { id },
      update: {
        amount,
        category,
        paymentMethod,
        transactionDate: utcDay(-daysAgo),
        memberId: student.student.id,
        recordedById: bursar?.user.id ?? admin.id,
        note,
      },
      create: {
        id,
        tenantId: school.id,
        memberId: student.student.id,
        amount,
        category,
        paymentMethod,
        transactionDate: utcDay(-daysAgo),
        recordedById: bursar?.user.id ?? admin.id,
        note,
      },
    });
  }

  await prisma.financeTransaction.upsert({
    where: { id: 'demo_fin_donation' },
    update: {
      amount: 10000,
      category: 'DONATIONS',
      paymentMethod: 'Bank Transfer',
      transactionDate: utcDay(-5),
      memberId: null,
      recordedById: bursar?.user.id ?? admin.id,
      note: 'Anonymous donor — science laboratory equipment fund',
    },
    create: {
      id: 'demo_fin_donation',
      tenantId: school.id,
      memberId: null,
      amount: 10000,
      category: 'DONATIONS',
      paymentMethod: 'Bank Transfer',
      transactionDate: utcDay(-5),
      recordedById: bursar?.user.id ?? admin.id,
      note: 'Anonymous donor — science laboratory equipment fund',
    },
  });

  // ---------------------------------------------------------------------
  // Broadcasts
  // ---------------------------------------------------------------------

  const senderId = principal?.user.id ?? admin.id;
  const broadcasts = [
    {
      id: 'demo_broadcast_001',
      target: 'all',
      unitId: null,
      category: 'impromptu',
      title: 'Term 1 Parent–Teacher Conference',
      message:
        'Dear families, our Term 1 parent–teacher conference holds on Friday from 9:00 a.m. to 2:00 p.m. in the main hall. Class teachers will share progress reports and learning plans. Please arrive with your child’s assessment booklet.',
      eventDate: utcDay(5),
      attachment: null,
      recipientCount: studentRecords.length + Object.keys(staffByEmail).length + 1,
      sentAt: utcDay(-1),
    },
    {
      id: 'demo_broadcast_002',
      target: 'unit',
      unitId: classrooms['Grade 12A'].id,
      category: 'test',
      title: 'Grade 12 Mock Examination Timetable',
      message:
        'The mock examination timetable for Grade 12A is attached. Examinations begin at 8:30 a.m. each day. Students should arrive 20 minutes early with their candidate number and writing materials.',
      eventDate: utcDay(10),
      attachment: {
        name: 'Grade-12-Mock-Examination-Timetable.pdf',
        size: '248 KB',
      },
      recipientCount: 5,
      sentAt: utcDay(-2),
    },
    {
      id: 'demo_broadcast_003',
      target: 'unit',
      unitId: classrooms['Grade 10A'].id,
      category: 'assignment',
      title: 'Mathematics Assignment 3',
      message:
        'Complete exercises 4.2 to 4.5 in the Senior Secondary Mathematics workbook. Show all working. Submit your solutions to Ms. Okafor by Thursday at 3:00 p.m.',
      eventDate: utcDay(3),
      attachment: null,
      recipientCount: 5,
      sentAt: utcDay(-4),
    },
    {
      id: 'demo_broadcast_004',
      target: 'all',
      unitId: null,
      category: 'curriculum',
      title: 'Updated Term 1 Biology Syllabus',
      message:
        'The Biology department has published the updated Term 1 syllabus. The revised sequence includes two additional laboratory practicals. Please review the attached document with your child.',
      eventDate: null,
      attachment: {
        name: 'Term-1-Biology-Syllabus.pdf',
        size: '412 KB',
      },
      recipientCount: studentRecords.length + Object.keys(staffByEmail).length + 1,
      sentAt: utcDay(-6),
    },
    {
      id: 'demo_broadcast_005',
      target: 'all',
      unitId: null,
      category: 'impromptu',
      title: 'Staff Development Day',
      message:
        'A staff development day on assessment for learning will hold next Wednesday. Classes will close at 12:30 p.m. and supervised study will be available in the library until 3:30 p.m.',
      eventDate: utcDay(7),
      attachment: null,
      recipientCount: Object.keys(staffByEmail).length + 1,
      sentAt: utcDay(-8),
    },
    {
      id: 'demo_broadcast_006',
      target: 'all',
      unitId: null,
      category: 'impromptu',
      title: 'Basketball Trials for the New Season',
      message:
        'Trials for the school basketball team will hold on Saturday at 10:00 a.m. on the outdoor court. Bring sports kit and water. All students in Grades 8–12 are welcome.',
      eventDate: utcDay(9),
      attachment: null,
      recipientCount: studentRecords.length,
      sentAt: utcDay(-11),
    },
  ];

  for (const broadcast of broadcasts) {
    await prisma.broadcast.upsert({
      where: { id: broadcast.id },
      update: {
        senderId,
        target: broadcast.target,
        unitId: broadcast.unitId,
        category: broadcast.category,
        title: broadcast.title,
        message: broadcast.message,
        eventDate: broadcast.eventDate,
        attachment: broadcast.attachment ?? undefined,
        recipientCount: broadcast.recipientCount,
        sentAt: broadcast.sentAt,
      },
      create: {
        id: broadcast.id,
        tenantId: school.id,
        senderId,
        target: broadcast.target,
        unitId: broadcast.unitId,
        category: broadcast.category,
        title: broadcast.title,
        message: broadcast.message,
        eventDate: broadcast.eventDate,
        attachment: broadcast.attachment ?? undefined,
        recipientCount: broadcast.recipientCount,
        sentAt: broadcast.sentAt,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------

  console.log('');
  console.log('Demo seed complete');
  console.log(`  School:      ${school.name} (${school.slug})`);
  console.log(`  Academic:    ${academicYear.name} · ${Object.keys(terms).length} terms`);
  console.log(`  Departments: ${Object.keys(departments).length}`);
  console.log(`  Classrooms:  ${Object.keys(classrooms).length}`);
  console.log(`  Staff:       ${Object.keys(staffByEmail).length}`);
  console.log(`  Students:    ${studentRecords.length}`);
  console.log(`  Portals:     ${studentRecords.length}`);
  console.log(`  Inventory:   ${INVENTORY.length}`);
  console.log(`  Finance:     ${FINANCE.length + 1}`);
  console.log(`  Broadcasts:  ${broadcasts.length}`);
  console.log('');
  console.log('Demo sign-in accounts (password: ' + demoPassword + ')');
  console.log('  Admin:       admin@schoolbook.test');
  console.log('  Principal:   principal@schoolbook.test');
  console.log('  Teacher:     teacher@schoolbook.test');
  console.log('  Counselor:   counselor@schoolbook.test');
  console.log('  Bursar:      bursar@schoolbook.test');
  console.log('  Student:     student001@schoolbook.test');
  console.log('  Parent:      guardian001@schoolbook.test');
  console.log('');
  console.log('Change or remove these demo accounts before launch.');
  console.log('');

  async function ensureUser({ email, firstName, lastName, role, phone = null }) {
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: school.id, email } },
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          role,
          phone,
          isActive: true,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          ...(existing.passwordHash ? {} : { passwordHash: DEMO_HASH }),
        },
      });
    }

    return prisma.user.create({
      data: {
        tenantId: school.id,
        email,
        passwordHash: DEMO_HASH,
        firstName,
        lastName,
        phone,
        role,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
  }
}

try {
  await main();
} catch (error) {
  console.error('');
  console.error('Demo seed failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
