# Production deployment

SchoolBook runs as one long-running NestJS process that serves the API and the compiled frontend. PostgreSQL is hosted on Supabase. This is the simplest production topology for the current code: same-origin cookies, one Prisma pool, and an in-process broadcast email queue.

## Supported hosts

SchoolBook is one NestJS process that serves the API and the frontend. It can run in two shapes:

- **Long-running Node host (recommended primary):** Render, Railway, Fly.io, or a VPS. The process serves the frontend, the API, health checks, and CSP headers from one origin with one Prisma pool. This is the simplest production topology.
- **Vercel:** supported as a single Vercel Function using the Express entrypoint in `src/app.ts`. Vercel serves `public/**` from its CDN and forwards API and health requests to the Nest function. See section 2b.

Either way, use PostgreSQL on Supabase and keep the app on one origin so the HttpOnly session cookies stay same-site.

## Why a long-running host is still the default

- The broadcast email queue runs after the HTTP response and is not durable across function freezes.
- Prisma keeps a connection pool for the life of the process. Serverless instances each open their own pool, so use the Supabase pooled connection string.
- Authentication uses same-origin HttpOnly cookies, not cross-site tokens.
- Health checks and migrations are easier to run and observe on a single service.

Vercel works for this codebase, but the first three points remain trade-offs. Move broadcast email to a durable queue before high-volume use, and keep an eye on database connections.

## 1. Create the production database

1. Create a **new** Supabase project. Do not reuse the development project.
2. Copy the **pooled** connection string into `DATABASE_URL`.
3. Copy the **direct** connection string into `DIRECT_URL`.
4. Rotate the database password if it has ever appeared in chat, logs, or a screenshot.
5. Confirm the connection strings include `sslmode=require` if Supabase provides it.

Use the pooled URL for the application and the direct URL for migrations. Do not run `prisma migrate dev` against production.

## 2. Deploy on Render (recommended)

The repository includes `render.yaml`.

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository.
3. Render creates the `schoolbook` web service from `render.yaml`.
4. Set the following environment variables in the Render dashboard:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase pooled URL |
| `DIRECT_URL` | Supabase direct URL |
| `JWT_SECRET` | At least 32 random characters, generated fresh for production |
| `FRONTEND_URL` | `https://<your-service>.onrender.com` |
| `NODE_ENV` | `production` (already in the blueprint) |
| `TRUST_PROXY` | `1` (already in the blueprint) |
| `SEED_DEMO_DATA` | `false` (already in the blueprint) |

Optional, only when the school is ready:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google sign-in |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Password reset and broadcast email |

5. Deploy. The build command installs both package trees, generates the Prisma client, and builds the frontend and backend.
6. The pre-deploy command runs `prisma migrate deploy` against `DIRECT_URL`.
7. The health check is `GET /health`. It returns `200` only when the database is reachable.

If the Render plan does not support a pre-deploy command, run the migration manually from the Render shell before the first start:

```bash
npm run prisma:migrate --prefix backend
```

Then restart the service.

## 2b. Deploy on Vercel

Vercel runs the Nest app as a single function through `src/app.ts` and serves the frontend from `public/`. The repository includes `vercel.json`, which configures the install command, build, static assets, clean URLs, and security headers.

1. In the Vercel project settings, clear **Root Directory** so it points at the repository root. If it is set to `backend`, Vercel runs the install command from `backend/` and the build fails with `npm error code EUSAGE` / `The npm ci command can only install with an existing package-lock.json`. The install command checks for this and stops with an explicit message.
2. Set **Framework Preset** to **Express** (or leave it on auto-detect).
3. Set the environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase pooled URL |
| `DIRECT_URL` | Supabase direct URL |
| `JWT_SECRET` | At least 32 random characters, generated fresh for production |
| `FRONTEND_URL` | `https://<your-project>.vercel.app` (or your custom domain) |
| `TRUST_PROXY` | `1` |
| `SEED_DEMO_DATA` | `false` |

4. For the first deployment, add `RUN_MIGRATIONS=1` so the build applies `prisma migrate deploy`. Remove it after the first successful deploy, or run migrations manually:

```bash
DATABASE_URL="..." DIRECT_URL="..." npm run prisma:migrate --prefix backend
```

5. Deploy the latest `main` commit. The build generates the Prisma client, builds the frontend and backend, and copies static assets into `public/`.
6. Set the production domain in Vercel and make `FRONTEND_URL` match it exactly, then redeploy so cookies and CORS use the right origin.

Health check: `GET /health`. Vercel functions are stateless, so the in-process broadcast email queue and connection pool behave differently than on Render; see the trade-offs above.

## 3. Bootstrap the first school and principal

Run this once against the production database. Use a strong password from a password manager; the script does not echo it.

```bash
export BOOTSTRAP_SCHOOL_NAME="Your School Name"
export BOOTSTRAP_SCHOOL_SLUG="your-school"
export BOOTSTRAP_PRINCIPAL_EMAIL="principal@yourschool.example"
export BOOTSTRAP_PRINCIPAL_FIRST_NAME="Ada"
export BOOTSTRAP_PRINCIPAL_LAST_NAME="Okafor"
export BOOTSTRAP_PRINCIPAL_PASSWORD="<strong-password-from-your-vault>"
npm run bootstrap:school --prefix backend
```

The script creates:

- the school tenant,
- the current academic year and three terms,
- default `Administration`, `Faculty`, and `Finance` departments,
- one `General Class` classroom,
- one `PRINCIPAL` account with a verified email.

It refuses to run if the school slug or user email already exists. It does not print the password.

After bootstrap, remove the `BOOTSTRAP_*` variables from the shell. They do not need to live in the Render environment.

## 4. First sign-in and onboarding

1. Open `https://<your-service>.onrender.com/login`.
2. Enter the school slug and the principal email/password.
3. Open **Members**. Create staff and student profiles.
4. Open a profile and use **Access & Login** to create a staff, student, or guardian login. The temporary password is shown once; share it privately.
5. Ask every user to change their password after first sign-in. Password reset by email requires SMTP.

Do not run `npm run seed:demo` against production.

## 5. Docker / VPS path

Build and run the included image:

```bash
docker build -t schoolbook .
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL="postgresql://..." \
  -e DIRECT_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e FRONTEND_URL="https://school.example" \
  -e TRUST_PROXY=1 \
  schoolbook
```

Run migrations once before starting the new container:

```bash
docker run --rm \
  -e DIRECT_URL="postgresql://..." \
  schoolbook \
  npm run prisma:migrate --prefix backend
```

For a VPS, put the container behind Caddy, Nginx, or a cloud load balancer with HTTPS. Set `TRUST_PROXY=1` so secure cookies and client IPs are handled correctly. Keep one application instance until the in-process email queue is replaced with a durable job queue.

## 6. Health, monitoring, and backups

- Uptime monitor: `GET /health` every 60 seconds, alert after two failures.
- Logs: Render log stream or the Docker log driver. Every request has an `x-request-id`; errors return a structured `{ error: { ... } }` body.
- Database: enable Supabase daily backups or point-in-time recovery. Run a restore drill before launch.
- Metrics: watch database connections, slow queries, 5xx rate, and response latency.
- Secret rotation: rotate `JWT_SECRET` and the database password on a schedule. Rotating `JWT_SECRET` signs everyone out, which is acceptable during a maintenance window.
- Email: the broadcast queue is in-process. A restart can drop queued messages; `bulk_mailed` means queued, not confirmed delivered. Move to a durable queue before high-volume email use.

## 7. Security checklist

- [ ] Fresh production database, no demo rows.
- [ ] Demo accounts removed or never seeded.
- [ ] Supabase password and `JWT_SECRET` rotated.
- [ ] `backend/.env`, `backend/write-env.ps1`, and any local secret files are not in Git.
- [ ] HTTPS enforced at the proxy or platform.
- [ ] `FRONTEND_URL` exactly matches the public origin.
- [ ] `TRUST_PROXY=1` behind a proxy.
- [ ] `NODE_ENV=production` so cookies are `Secure`.
- [ ] CSP present on HTML responses; framing and object embeds blocked.
- [ ] Login throttling active; review limits for your traffic.
- [ ] Backups enabled and a restore has been tested.
- [ ] Google/SMTP/payment credentials are only added when the school can support them.
- [ ] Card payments still require a gateway reference; SchoolBook does not store card numbers.
- [ ] Last active administrator and self-archive protections verified.

## 8. Post-deploy smoke test

```bash
curl -fsS https://<your-service>/health
curl -fsS https://<your-service>/api/auth/providers
```

Then in a browser:

1. Sign in as the principal.
2. Open all seven tabs.
3. Create a staff profile and a staff login.
4. Sign out, sign in as the new staff member, and confirm the correct tabs are visible.
5. Create a student and a guardian login; confirm the guardian sees the linked student portal.
6. Record a small finance transaction with a gateway reference and confirm it appears in the ledger.
7. Publish a broadcast and confirm it appears in the feed.
8. Sign out and confirm `/app` redirects to `/login`.

## 9. Rollback

- Keep the previous Render deploy available; roll back the service in the dashboard.
- Migrations are forward-only. If a migration must be reversed, write a new migration rather than editing an applied one.
- Database restores are a last resort; confirm the restore target before overwriting production.

## 10. Known launch boundaries

- Google OAuth is hidden until credentials are configured.
- Password reset and broadcast email are disabled until SMTP is configured.
- Card payments record an operator-supplied gateway reference; they are not verified with a provider API.
- Syllabus attachments are recorded as metadata on broadcasts and portals; binary upload/storage is not implemented.
- Broadcast email delivery is queued in-process, not durable across restarts.
