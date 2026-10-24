# SchoolBook — Backend & Database Merge Plan

> Status: **proposal** · Created 2026-10-24
> Scope: merge the pushed `backend/` (NestJS + Prisma + Postgres + JWT auth) into the existing
> `src/backend` (Express + `database.json` + header auth) framework without breaking the current UI.

---

## 1. Where we are today

The repo currently contains **two independent backends** that do not talk to each other.

| | Existing framework (`src/backend`) | Pushed service (`backend/`) |
|---|---|---|
| Framework | Express 4 | NestJS 12 |
| Language/build | TS 5.4, `tsc`, ESM | TS 6.0, `nest build`, ESM |
| Persistence | `database.json` via in-memory `collections` | Prisma 7 → PostgreSQL |
| Auth | `X-User-ID` header (trusted, spoofable) | JWT access cookie + rotating refresh cookie, argon2, Google OAuth |
| Tenant isolation | `X-Tenant-ID` header, validated against JSON | `tenantId` from signed JWT, enforced by `TenantGuard` |
| Validation | Manual `if (!x)` checks | `class-validator` DTOs + global `ValidationPipe` |
| Hardening | none | helmet, throttler, role guard, audit model |
| Domain scope | members, attendance, inventory, finance, messaging, portal, units | full academic schema (users, staff, students, classes, exams, fees, announcements) |
| Implemented endpoints | 7 routers, ~30 routes | auth only (`/auth/*`) + health |
| Frontend | served from `src/frontend` on :3000, persona switcher | none — API only |

**Reality check:** `backend/` is an *auth + data-model foundation*, not a finished API. The six
business domains still live only in Express/JSON. So this is not a "wire up the new server" job —
it is a **port of the existing API onto the new foundation**.

Also important: the working tree has uncommitted edits (`src/backend`, `src/frontend`, `README.md`,
`schema.sql`, `database.json`). `database.json` is gitignored but modified — **snapshot it before
any migration** or demo data is lost.

---

## 2. Gaps and conflicts that decide the plan

### 2.1 Architecture conflict
Both apps want to be "the server" and both bind port 3000. One has to become the host.

### 2.2 Auth conflict (the biggest one)
The frontend authenticates by sending `X-User-ID` **chosen from a dropdown**. That is a demo
persona switcher, not auth. NestJS expects a login flow that issues cookies.

```
frontend (today)                         frontend (after merge)
X-Tenant-ID: tenant_oakridge      →      Cookie: schoolbook_access_token
X-User-ID: m_oak_principal               GET /api/auth/me → { user }
(anyone can send any user id)            POST /api/auth/login (email + password / Google)
```

The UI has **no login screen at all** (`landing.html` has no form, `index.html` has a persona
`#profile-selector`). This is a product decision, not just a refactor — see §9.

### 2.3 Data-model conflicts
The Prisma schema is richer but does not cover four existing features, and one feature has a
different shape:

| Existing concept | Prisma equivalent | Gap |
|---|---|---|
| `Tenant` | `School` | id/slug mapping; `logo_url` exists as `logoUrl` |
| `Unit` (departments **and** grade cohorts) | `Department`, `Classroom` | one legacy table, two target tables |
| `Member` (identity + profile + role) | `User` + `Staff`/`Student` (+ `Guardian`) | must be split; several fields have no column |
| `Attendance` (school-wide *service*) | `AttendanceSession` + `AttendanceRecord` (per classroom + term) | legacy roll call is tenant-wide, not class-bound; also mixes staff + students |
| `InventoryItem` | — | **no model** |
| `FinancialRecord` (ledger row) | `FeeStructure` + `Invoice` + `InvoiceItem` + `Payment` | legacy is a flat transaction, not invoiced |
| `BroadcastMessage` | `Announcement` | missing `category`, `attachment`, `bulk_mailed`, `recipient_count`, `target` |
| `StudentPortal` (grades, remarks, syllabus) | `ExamResult`, `StudentTermPerformance`, `Guardian` | **no direct model**; portal is a hand-edited document |
| `Role` = Principal \| Teacher \| Counselor \| Student | `UserRole` = SUPER_ADMIN…STUDENT | **no `COUNSELOR`**; naming/title-case mismatch |

### 2.4 Missing profile columns
Legacy `Member` carries fields with no Prisma home: `dob_month`/`dob_day` (year-less DOB),
`academic_score`, `office_location`, `office_hours`, `bio`, `specialization`,
`guardian_name/email/phone` (partly covered by `Guardian`), and a student `position` used as a
grade label.

### 2.5 Runtime/tooling conflict
- Root: **npm**, TS 5.4, `@types/node` 20, build → `dist/`.
- `backend/`: **pnpm** (not installed here), TS 6, `@types/node` 24, build → `backend/dist/`.
- Two lockfiles (`package-lock.json`, `pnpm-lock.yaml`) and two TS majors. Hoisting them into one
  workspace risks version skew on Prisma/TS types.
- **No PostgreSQL, Docker, or pnpm is installed on this machine**, and there is no `.env` or
  `.env.example` in `backend/`. The Nest app cannot currently boot.

### 2.6 Repo hygiene (blocks a clean merge)
- `node_modules/` is **tracked** (1,002 files) despite `.gitignore`.
- `dist/` is **tracked** (10 files) despite `.gitignore`.
- `src/frontend/app.js` + `.map` are generated but tracked (acceptable, but noisy).
- `database.json` is gitignored yet tracked and modified.
- Root `schema.sql` now duplicates `backend/prisma/migrations/*` and has already drifted
  (roles `Dean` removed there but not in Prisma enums).

### 2.7 Small bugs found in the pushed backend
- `backend/test/app.e2e-spec.ts` expects `'Hello World!'`; `AppService.getStatus()` returns a JSON
  status object → e2e test fails as-is.
- `TenantGuard` reads `user.emailVerifiedAt`, while `JwtStrategy` sets it via `(user as any)` —
  works, but the type should be real.
- `main.ts` CORS falls back to `origin: true` with `credentials: true` when `FRONTEND_URL` is
  unset → reflects any origin. Must fail closed in production.
- `AuthController.refresh` hand-parses cookies and throws via a dynamic `import()`; works, but a
  `cookie-parser` + typed exception is cleaner.
- No global exception filter → Nest's error body (`{statusCode,message,error}`) does **not** match
  what the frontend reads (`errorData.error`), so every toast would show "Bad Request".

---

## 3. Target architecture (recommended)

**One server, one database, one auth model: NestJS + Prisma/Postgres becomes the platform; the
Express app is retired through a strangler migration.**

```
                       ┌─────────────────────────────────────────┐
  browser ──────────▶  │  NestJS (port 3000)                     │
   (same origin)       │  ├── ServeStatic  → src/frontend         │
                       │  ├── AuthModule         (JWT, OAuth)    │
                       │  ├── MembersModule      (User+Staff/Std)│
                       │  ├── AttendanceModule                   │
                       │  ├── InventoryModule                    │
                       │  ├── FinanceModule                      │
                       │  ├── MessagingModule                    │
                       │  ├── PortalModule                       │
                       │  └── UnitsModule                        │
                       └───────────────┬─────────────────────────┘
                                       │ Prisma 7 (pg adapter)
                                  PostgreSQL
```

Why not the alternatives:

| Option | Verdict |
|---|---|
| **A. NestJS canonical** (recommended) | Reuses the security work already done; one auth model; real DB. Cost: port 7 routers (~30 routes) + frontend login. |
| B. Express stays host, Nest only for auth | Fastest to demo, but keeps two auth models, two tenant models and two DBs forever. This is debt, not a merge. |
| C. Drop Nest, port Prisma/auth into Express | Throws away OAuth, refresh rotation, guards, DTO validation, tests. Most work, least value. |

**Transition trick:** Nest can serve as the host *and* temporarily mount the legacy Express router,
so there is one port and one origin the whole time:

```ts
// backend/src/main.ts (transition only)
const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.useStaticAssets(frontendDir, { index: false });
app.use('/api', legacyExpressRouter);   // removed in Phase D
```

This keeps the current UI fully working while routes are ported one by one.

---

## 4. Recommended domain mapping

Rule of thumb: **normalize core people/academic data onto Prisma; add thin compatibility models
only where Prisma has no equivalent.** Keep the legacy API response shapes during the port so the
frontend never has to change mid-migration.

| Legacy | Target | Action |
|---|---|---|
| `Tenant` | `School` | Seed with `id = 'tenant_oakridge'` (keep legacy ids) and `slug = 'oakridge'`. Store legacy id as-is; `slug` used for login. |
| `Unit` | `Department` **or** `Classroom` | Heuristic at seed time: names containing `Grade/Class/Cohort` → `Classroom` (+`gradeLevel`, `section`); everything else → `Department`. Add `legacyUnitId String? @unique` to both for stable lookups. |
| `Member` (staff) | `User` + `Staff` | `User` = identity/role; `Staff` = profile. `position → jobTitle`. Add `officeLocation`, `officeHours`, `bio`, `specialization`, `birthMonth`, `birthDay` to `Staff`. |
| `Member` (student) | `User` + `Student` + `Enrollment` | `admissionNumber`/`admissionDate` seeded deterministically. `position` → `Classroom.name` via `Enrollment`. Add `birthMonth`, `birthDay`, `cachedAcademicScore`. |
| `guardian_*` | `Guardian` + `StudentGuardian` | Relation `GUARDIAN`, `isPrimary = true`. |
| `Attendance` | **`ServiceAttendance`** (new) | Exact legacy semantics: `(tenantId, memberId, serviceDate, serviceName)` unique, `status`, `recordedBy`. Keep `AttendanceSession/Record` for the future per-class registers. Do **not** force staff roll call into student tables. |
| `InventoryItem` | **`InventoryItem`** (new) | `status` enum `ACTIVE/FAULTY/UNAVAILABLE`, optional `unitId` (Department or Classroom). |
| `FinancialRecord` | `Invoice` + `InvoiceItem` + `Payment` | Seed 1 invoice + 1 payment per legacy row (7 rows). Category → `FeeStructure` per tenant/academic year. Projections aggregate `Payment` by fee category. |
| `BroadcastMessage` | `Announcement` + new columns | Add `category`, `attachment Json?`, `bulkMailed`, `recipientCount`, `target`. `audience` stays for future targeting. |
| `StudentPortal` | **`StudentPortal`** (new) | `studentId @unique`, `gradeLevel`, `overallScore`, `term`, `grades Json`, `remarks`, `syllabusAttachments Json`, `updatedById`. Grades can later be derived from `ExamResult`. |
| `Role` | `UserRole` | **Add `COUNSELOR` to the enum** (migration). API maps `PRINCIPAL → "Principal"` etc. so the frontend contracts stay unchanged. |
| `X-User-ID` profile list | `GET /api/auth/profiles` shim | Phase B only; returns composed `Member` DTOs. Removed in Phase C. |

> Migrations are additive and nullable first, then backfilled, then tightened. No destructive
> changes until Phase D.

---

## 5. Phased plan

### Phase 0 — Safety net & hygiene (½ day)
- [ ] Snapshot `database.json` → `backend/prisma/fixtures/database.seed.json` (committed, so seeds
      are reproducible; today the file is gitignored).
- [ ] `git rm -r --cached node_modules dist` (keep on disk); remove `database.json` from the index.
- [ ] Add `docs/` entry to README; mark root `schema.sql` deprecated (Prisma migrations are canonical).
- [ ] Add `backend/.env.example`:
      `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT`, `FRONTEND_URL`,
      `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`, `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY`,
      `GOOGLE_AUTO_PROVISION`, mail settings.
- [ ] Provision PostgreSQL (see §9) and run `prisma migrate deploy` + `generate`.
- [ ] Fix the e2e test expectation; confirm `npm --prefix backend run build` passes.

**Exit:** Nest boots, `/` returns the status JSON, migrations applied, DB reachable.

### Phase 1 — Schema reconciliation (1–2 days)
- [ ] Add to `backend/prisma/schema.prisma`:
      `COUNSELOR` role; `legacyUnitId` on `Department`/`Classroom`; profile columns on
      `Staff`/`Student`; `ServiceAttendance`; `InventoryItem`; `StudentPortal`; `Announcement`
      extras.
- [ ] Generate one additive migration; review the SQL by hand.
- [ ] Write `backend/prisma/seed.ts`: idempotent upserts with **explicit legacy ids** so all
      foreign keys line up; split units, members, attendance, finance, inventory, broadcasts,
      portals. Log a count reconciliation table at the end.
- [ ] Add a `verify` script that compares row counts against the fixture.

**Exit:** `seed.ts` run twice produces identical data; counts match the JSON fixture.

### Phase 2 — Port the API, keep the UI untouched (3–5 days)
Build Nest feature modules that return the **exact legacy response shapes**. Keep the Express
`X-User-ID`/`X-Tenant-ID` contract behind a temporary guard:

```ts
// backend/src/common/legacy/legacy-auth.guard.ts  (gated by LEGACY_AUTH=true)
// resolves X-Tenant-ID against School.id and X-User-ID against User.id, attaches request.user
```

Order (each route ported = delete it from the Express router):
1. `GET /api/tenants` → `SchoolsController`
2. `GET /api/auth/profiles` → `MembersController.profiles` (compat DTO)
3. `units` → `UnitsController` (Department/Classroom split hidden behind the DTO)
4. `members` → `MembersController` + `MembersService` (pruning rules preserved)
5. `attendance` → `AttendanceController` over `ServiceAttendance`
6. `inventory` → `InventoryController`
7. `financials` → `FinanceController` (invoice + payment in one transaction)
8. `messaging` → `MessagingController` over `Announcement`
9. `portal` → `PortalController`

Cross-cutting:
- [ ] `LegacyExceptionFilter` returning `{ error: string }` so the frontend's
      `errorData.error` keeps working.
- [ ] `@Roles()` decorators replacing `requireRole` / `requireUnitOrPrincipal`
      (unit rules become a `UnitScopeGuard`).
- [ ] `class-validator` DTOs for every body; no more ad-hoc checks.
- [ ] Preserve the 30-day inactivity engine as a scheduled job or a service called on read
      (decision: keep it explicit and testable — recommended `@nestjs/schedule`).

**Exit:** with `LEGACY_AUTH=true`, the existing frontend works end-to-end against Postgres;
the Express routers are no longer mounted.

### Phase 3 — Real auth + frontend session (2–3 days)
- [ ] `src/frontend/login.html` + `ts/login.ts` (email/password + Google button).
- [ ] `apiFetch`: `credentials: 'include'`, drop `X-User-ID`/`X-Tenant-ID`, add one retry through
      `POST /api/auth/refresh` on 401, redirect to `/login` on second failure.
- [ ] `state.ts`: derive tenant from `GET /api/auth/me`; remove `activeUserId` impersonation.
- [ ] Replace `#profile-selector` with a user menu; tenant selector becomes a workspace switcher
      backed by the user's actual memberships.
- [ ] Route guard on `index.html` / `app.js` bootstrap.
- [ ] Logout button wired to `POST /api/auth/logout`.
- [ ] Set `LEGACY_AUTH=false`; delete `legacy-auth.guard.ts` and `/api/auth/profiles`.

**Exit:** demo personas are seeded as real users with passwords (dev only); no header auth path
remains; cookies + CORS verified same-origin.

### Phase 4 — Retire the Express app (1 day)
- [ ] Move static hosting into Nest (`ServeStaticModule` or `useStaticAssets`) including the `/`
      landing vs `/app` dashboard split and SPA fallback.
- [ ] Delete `src/backend/**` and `dist/` from git; keep `src/shared/types.ts` only if the frontend
      still imports it (move to `src/frontend/ts/contracts`).
- [ ] Delete/deprecate root `schema.sql`; update README architecture + run instructions.
- [ ] Delete `database.json` (fixture remains in `backend/prisma/fixtures`).

**Exit:** single process, single lockfile story, no duplicated logic.

### Phase 5 — Hardening & CI (1–2 days)
- [ ] CORS allowlist fails closed in production; `trust proxy`; helmet everywhere.
- [ ] Error filter + structured logging; wire `AuditLog` for mutations.
- [ ] Throttle auth routes verified behind a proxy.
- [ ] e2e tests per module; seed-based integration test; `npm test` in CI.
- [ ] Optional: storage for broadcast attachments via `SupabaseService`.

---

## 6. Build & tooling decision

Keep `backend/` as an **independent npm package**, not an npm workspace:

```jsonc
// root package.json
"scripts": {
  "dev":            "concurrently -n api,fe -c blue,magenta \"npm:dev:api\" \"npm:watch:fe\"",
  "dev:api":        "npm --prefix backend run start:dev",
  "dev:legacy":     "tsx watch src/backend/server.ts",   // until Phase 4
  "build":          "npm run build:fe && npm --prefix backend run build",
  "prisma:migrate": "npm --prefix backend exec prisma migrate dev"
}
```

Rationale: avoids hoisting Prisma 7 / TS 6 against the root TS 5.4 toolchain, and does not require
pnpm (not installed). Replace `backend/pnpm-lock.yaml` with a `backend/package-lock.json`
(`npm --prefix backend install`) so there is one package manager. If you prefer pnpm long-term,
install it and convert the *root* too — don't mix.

Run the API from `backend/` so `.env` resolution and `prisma` paths are unambiguous.

---

## 7. Compatibility matrix (Phase 2)

| Legacy route | New controller | Notes |
|---|---|---|
| `GET /api/tenants` | `SchoolsController.findAll` | returns `{id,name,logo_url}` |
| `GET /api/auth/profiles` | `MembersController.profiles` | temporary |
| `GET/POST/PUT/DELETE /api/members` | `MembersController` | role pruning + unit checks preserved |
| `GET /api/attendance/sheet` | `AttendanceController.sheet` | union staff + students |
| `POST /api/attendance/mark` | `AttendanceController.mark` | upsert on 4-key unique |
| `POST /api/attendance/close-service` | `AttendanceController.close` | bulk auto-absent |
| `GET /api/attendance/stats` | `AttendanceController.stats` | `type=faculty` |
| `GET/POST/PUT/DELETE /api/inventory` | `InventoryController` | unit keyword rules → `UnitScopeGuard` |
| `GET /api/financials` | `FinanceController.ledger` | join contributor name |
| `POST /api/financials/pay` | `FinanceController.pay` | invoice+payment transaction |
| `GET /api/financials/projections` | `FinanceController.projections` | aggregate by category |
| `GET/POST /api/messaging*` | `MessagingController` | category/attachment columns |
| `GET/PUT /api/portal/:studentId` | `PortalController` | synthesize on first read |
| `GET/POST/DELETE /api/units` | `UnitsController` | split mapping hidden in DTO |

---

## 8. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| `database.json` is the only copy of current demo data | data loss | snapshot to committed fixture first (Phase 0) |
| No Postgres/Docker/pnpm locally | cannot validate the merge | provision hosted PG or local install before Phase 1 |
| Prisma 7 + TS 6 + Node 26 are bleeding edge | build failures | pin versions; keep backend isolated; run a smoke test early |
| Removing persona switcher changes the demo | product/UX surprise | decide in §9; optionally keep a dev-only switcher |
| Compatibility tables (`ServiceAttendance`, `StudentPortal`) ossify | long-term duplication | document them as transitional; add a convergence task in Phase 5 |
| Two TS majors / two lockfiles | dependency skew | separate package + npm, no workspace hoisting |
| Tracked `node_modules`/`dist` | noisy merges, huge diffs | untrack in Phase 0 |
| Nest error body ≠ `{error}` | broken error toasts | global `LegacyExceptionFilter` + tolerant frontend |

---

## 9. Decisions — locked 2026-10-24

1. **Runtime winner: NestJS canonical.** `backend/` becomes the platform; `src/backend` is ported
   over and retired (Phases 2–4).
2. **Dev database: hosted Postgres** (Neon or Supabase). `backend/.env` needs `DATABASE_URL`
   (pooled) and `DIRECT_URL` (direct, used by `prisma7.config.ts` for migrations).
3. **Auth UX: full login + Google.** Cookie session, refresh-on-401, real user menu; the persona
   switcher is removed. No header auth in production. `LEGACY_AUTH=true` exists only as the
   Phase 2 bridge and is deleted in Phase 3.

Still to confirm during Phase 1 (not blocking):
- Add `COUNSELOR` to `UserRole` (recommended) vs remap to `ADMIN`/`TEACHER`.
- Accept compatibility models `ServiceAttendance` + `StudentPortal` (recommended) vs fold them into
  the academic models now.

## 10. Immediate next step (Phase 0)

Needs from you: **hosted Postgres connection strings** (pooled + direct) and a **JWT secret**
(or I can generate one).

Then I will, in order:
1. Snapshot `database.json` → `backend/prisma/fixtures/database.seed.json`.
2. Untrack `node_modules/`, `dist/`, and `database.json` from git (files stay on disk).
3. Add `backend/.env.example` and `backend/.env` (gitignored) with the provided credentials.
4. Switch `backend/` from pnpm to npm, add root dev/build scripts, fix the failing e2e test.
5. Run `npm --prefix backend install`, `prisma migrate deploy`, `prisma generate`, and boot the
   API once to prove the foundation before any porting begins.
