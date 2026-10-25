# SchoolBook SMS

SchoolBook is a multi-tenant school management and student information system. The production build is a single NestJS service that serves the API and the compiled frontend, backed by PostgreSQL (Supabase in the reference deployment).

## What is in this build

- **Seven workspaces**: overview, student portal, members, attendance, inventory, finance, and broadcast.
- **Real authentication**: HttpOnly cookie sessions, rotating refresh tokens, login throttling, role-based route guards, and optional Google OAuth.
- **Admin onboarding**: principals and vice principals can create staff, student, and guardian logins from a member profile. Temporary passwords are shown once and are never emailed automatically.
- **Tenant isolation**: every query is scoped to the signed-in user's school.
- **Honest integration states**: Google sign-in, password-reset email, broadcast email, and payment-gateway verification are disabled until their credentials are configured. The UI does not pretend they are live.
- **Production hardening**: fail-fast environment validation, CSP, request IDs, structured request logs, health checks, soft-delete for members, self-archive protection, and last-administrator protection.

## Architecture

| Layer | Technology |
| --- | --- |
| API | NestJS 12, TypeScript, Prisma 7 |
| Database | PostgreSQL 17 (Supabase) |
| Frontend | Vanilla TypeScript, esbuild, HTML/CSS |
| Auth | Cookie JWT access token + rotating refresh token; Google OAuth optional |
| Deployment | Single Node web service (Render/Railway/Fly/VPS); Supabase for Postgres |

The NestJS compatibility layer keeps the original frontend response shapes stable while all persistence goes through Prisma. There is no JSON-file database in the production path.

## Quick start

Prerequisites: Node.js 22+, npm, and a PostgreSQL database (local or Supabase).

```bash
# 1. Install dependencies
npm install
npm ci --prefix backend

# 2. Configure the backend
cp backend/.env.example backend/.env
# Edit backend/.env: DATABASE_URL, DIRECT_URL, JWT_SECRET, FRONTEND_URL

# 3. Apply migrations and generate the Prisma client
npm run prisma:migrate --prefix backend
npm run prisma:generate --prefix backend

# 4. Build the frontend and backend
npm run build

# 5. Start the production server
npm start
```

Open `http://localhost:3000`. The API is served under `/api`; health checks are at `/health` and `/health/live`.

For development:

```bash
npm run watch:fe   # rebuild the browser bundle on change
npm run dev        # NestJS watch mode
```

## Environment variables

See `backend/.env.example` for the full list. The required values are:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL connection used by the app |
| `DIRECT_URL` | Direct PostgreSQL connection used by Prisma migrations |
| `JWT_SECRET` | At least 32 random characters; rotate before launch |
| `FRONTEND_URL` | Public origin allowed by CORS and used in auth links |
| `NODE_ENV` | `production` on the deployed service |
| `PORT` | HTTP port (the platform usually injects this) |
| `TRUST_PROXY` | Set to `1` behind a reverse proxy or load balancer |

Optional integrations:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- `SEED_DEMO_DATA=true` and `SEED_DEMO_PASSWORD` only for a disposable demo database

Without SMTP, password reset and broadcast email remain disabled. Without Google credentials, the Google button stays hidden. Without a payment-gateway integration, card payments require an operator-supplied gateway reference and are not verified by SchoolBook.

## Demo data

Demo seeding is opt-in and refuses to run in production without an explicit `SEED_DEMO_PASSWORD`.

```bash
# backend/.env
SEED_DEMO_DATA=true
SEED_DEMO_PASSWORD=choose-a-demo-password

npm run seed:demo
```

Do not seed demo data into a database that will hold real school records.

## Roles

| Role | Access |
| --- | --- |
| Principal / Vice Principal | All seven workspaces, finance, member administration, login onboarding, inventory deletion |
| Teacher / Counselor | Overview, portal editing, members, attendance, inventory, broadcast; no finance vault |
| Librarian | Overview, read-only portal, members, inventory editing, broadcast feed; no attendance or finance |
| Accountant / Bursar | Overview, members, read-only inventory, finance, broadcast feed; no portal or attendance editing |
| Student / Guardian | Overview, their own read-only portal, broadcast feed |

Role checks are enforced in the API, not only in the UI.

## API and health checks

- `GET /health` — liveness plus database ping
- `GET /health/live` — process liveness
- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`
- `GET /api/auth/providers` — which optional auth providers are configured
- `GET /api/members/me` — signed-in member; guardians resolve to their first linked student
- `POST /api/users` — principal/admin-only account provisioning
- Compatibility endpoints: `/api/members`, `/api/units`, `/api/attendance/*`, `/api/inventory`, `/api/financials`, `/api/messaging`, `/api/portal`, `/api/tenants`

## Testing

```bash
# Backend unit tests
npm test --prefix backend

# Backend end-to-end tests (requires a test database)
npm run test:e2e --prefix backend

# Local smoke checks
backend/smoke.ps1
backend/auth-smoke.ps1
backend/refresh-smoke.ps1
node backend/ui-smoke.mjs
```

The UI smoke test uses headless Chrome and writes screenshots to `backend/ui-screenshots/`.

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the Render, Docker, and VPS paths, migration commands, health checks, backups, and post-deploy checklist.

**Vercel note:** Vercel is a good host for static assets, but this build expects one long-running Node process. The in-process broadcast email queue, Prisma connection pooling, and same-origin cookie sessions do not fit a serverless function cleanly. Deploy the single NestJS service to Render/Railway/Fly/VPS. If the frontend is split onto Vercel later, the API must move to a persistent host and cookies must be configured for cross-site use.

## Repository layout

```text
backend/                 NestJS API, Prisma schema, migrations, seeds
src/frontend/            HTML, CSS, TypeScript source, compiled browser bundles
src/shared/              Shared API types
docs/                    Merge plan and deployment runbook
scripts/                 Legacy migration/import helpers
```

## Before launch

1. Rotate the database password and `JWT_SECRET` that were used during development.
2. Create a fresh production database; do not reuse the demo database.
3. Run `prisma migrate deploy` against the production direct URL.
4. Bootstrap one school and one principal account using the deployment runbook.
5. Configure HTTPS, backups, monitoring, and a restore drill.
6. Add Google OAuth, SMTP, and payment-gateway credentials only when the school is ready to use them.
