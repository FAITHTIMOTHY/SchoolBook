import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AcademicYearModule } from './academicyear/academicyear.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { ClassroomModule } from './classroom/classroom.module.js';
import { DepartmentModule } from './department/department.module.js';
import { StaffModule } from './staff/staff.module.js';
import { StaffAttendanceModule } from './staffattendance/staffattendance.module.js';
import { StudentsModule } from './students/students.module.js';
import { SubjectModule } from './subject/subject.module.js';
import { TermModule } from './term/term.module.js';
import { TimetableModule } from './timetable/timetable.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { TenantModule } from './tenant/tenant.module.js';
import { UsersModule } from './users/users.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { TenantGuard } from './auth/guards/tenant.guard.js';
import { CustomThrottlerGuard } from './common/throttler/custom-throttler.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    TenantModule,
    UsersModule,
    StaffModule,
    StaffAttendanceModule,
    DepartmentModule,
    SubjectModule,
    AcademicYearModule,
    TermModule,
    ClassroomModule,
    TimetableModule,
    StudentsModule,
    AttendanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
