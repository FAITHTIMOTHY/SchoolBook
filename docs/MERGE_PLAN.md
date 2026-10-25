# Backend merge - completion record

Status: **completed** (2026-10-25)

The repository now has one production backend: the NestJS service in `backend/`, backed by PostgreSQL through Prisma. The legacy Express server and `database.json` path are no longer part of the runtime.

## What changed

| Area | Result |
| --- | --- |
| Server | NestJS 12 serves the API and the compiled frontend from one process |
| Persistence | Prisma 7 + PostgreSQL (Supabase in the reference deployment) |
| Auth | HttpOnly cookie JWT + rotating refresh tokens; Google OAuth optional |
| Tenant isolation | Tenant comes from the signed token, not a client header |
| Legacy API | Compatibility controllers under `/api` preserve the frontend response shapes |
| Frontend | Real login, session bootstrap, role-aware tabs, admin login onboarding |
| Legacy Express | Retired from the production path |
| JSON database | No longer used by the production path |

## Compatibility models

The legacy UI needed flat records that the academic schema did not model directly. These tables were added and are mapped through `backend/src/compat/`:

- `ServiceAttendance`
- `InventoryItem`
- `FinanceTransaction` (including gateway `reference`)
- `Broadcast`
- `StudentPortal`
- `Student.unitId`

Units map to `Department` and `Classroom`. The legacy finance ledger uses `FinanceTransaction`; academic invoices and payments remain available for the academic schema.

## Migrations

The committed migration history is:

1. `20261023050716_init`
2. `20261023062453_add_google_auth`
3. `20261025010000_add_compatibility_models`
4. `20261025010500_add_student_unit`
5. `20261025020000_add_finance_reference`

Apply with `npm run prisma:migrate --prefix backend` against the direct database URL. Do not use `prisma migrate dev` against the shared database.

## Verification

- Fresh-schema `prisma migrate deploy` test passes.
- Production bootstrap test creates a school, academic year, terms, departments, classroom, and principal in a temporary schema.
- Backend unit tests pass (73 tests).
- API smoke tests pass for health, auth, members, units, attendance, inventory, finance, messaging, portal, and public tenants.
- Headless Chrome UI smoke passes for principal, teacher, librarian, bursar, student, and guardian roles, including admin login onboarding and silent refresh.
- CSP is enabled with the inline-script/style allowances required by the current frontend.

## Remaining boundaries

These are deliberate launch boundaries, documented in `docs/DEPLOYMENT.md`:

- Google OAuth is hidden until credentials are configured.
- Password reset and broadcast email are disabled until SMTP is configured.
- Card payments record an operator-supplied gateway reference; they are not verified by a provider API.
- Syllabus attachments are metadata only; binary upload/storage is not implemented.
- Broadcast email delivery is queued in-process, not durable across restarts.
