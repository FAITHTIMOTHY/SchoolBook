# SchoolBook backend

NestJS API for SchoolBook SMS. All persistence goes through Prisma and PostgreSQL. The compatibility controllers under `/api` preserve the response shapes expected by the existing frontend.

## Setup

```bash
npm ci
cp .env.example .env
# Fill DATABASE_URL, DIRECT_URL, JWT_SECRET, FRONTEND_URL
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

The API listens on `PORT` (default `3000`). The global API prefix is `/api`; health endpoints are unprefixed.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run start:dev` | NestJS watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled server |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (test database required) |
| `npm run prisma:migrate` | Apply committed migrations |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:seed` | Run the standard seed |
| `node prisma/seed-demo.mjs` | Opt-in demo data; requires `SEED_DEMO_DATA=true` |

## Database rules

- Use the pooled `DATABASE_URL` for the application and the direct `DIRECT_URL` for migrations.
- Do not run `prisma migrate dev` against the shared Supabase database. Create a migration with `prisma migrate diff`, commit the SQL, and apply it with `prisma migrate deploy`.
- The fresh-schema migration check is `./test-migrations.ps1` on Windows.

## Optional integrations

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
- Without SMTP, password reset and broadcast email are disabled by design.

See the repository root `README.md` and `docs/DEPLOYMENT.md` for the full deployment and security notes.
