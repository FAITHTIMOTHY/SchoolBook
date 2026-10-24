# Security Rules

## 1. Strict Tenant Isolation (Discriminator-Based Security)
- **Never trust client input**: Do not extract `tenantId` or `schoolId` from request body, query params, or headers. These are untrusted.
- **Extract from verified JWT**: Always get `tenantId` from the cryptographically signed JWT payload attached via `TenantGuard` (and the authenticated user context).
- **Enforce Prisma scoping**: Every database query must explicitly filter by the active tenant. For tenant-scoped models, include `tenantId` in `where` clauses (and prefer using a tenant-scoped helper/service method).
- **Guard at boundaries**: Apply `TenantGuard` to all tenant-scoped routes/controllers. Use `@CurrentUser()` to access the verified tenant context.
- **No cross-tenant access**: Never return or mutate data across tenants. If a resource lookup could span tenants, always scope by `tenantId`.

### Implementation notes
- JWT must include `tenantId` (already present in access/refresh payloads).
- Use a `TenantGuard` to validate and attach tenant context.
- Prefer repository/service methods that require `tenantId` as a parameter (avoid global queries).
- When creating records, always set `tenantId` from the verified context, never from client input.

## 2. Password Hashing & Token Hygiene
- **Secure Hashing**: Use Node.js's native `crypto` (scrypt) or `argon2` for any standard username/password logins. Avoid weak hashing algorithms like MD5 or plain SHA-256.
- **Short-Lived Access Tokens**: Keep JWT access tokens short-lived (e.g., 15 minutes). Implement a secure, `httpOnly`, `secure` (in prod) refresh token cookie with rotation to handle session expiration safely. Rotate and revoke refresh tokens on use/logout; store only hashed refresh tokens in the database.
- **Secrets**: Never log tokens or secrets.

## 3. Role-Based Access Control (RBAC) & Scopes
- **Use custom decorators/guards**: Use custom NestJS decorators (e.g., `@Roles('ADMIN', 'TEACHER')`) alongside a `RolesGuard` to ensure users can only hit endpoints matching their privilege level within their specific tenant.
- **Tenant-scoped roles**: Enforce roles in the context of the verified tenant (combine with `TenantGuard`).

## 4. Rate Limiting & Brute-Force Protection
- **Throttling**: Install and configure `@nestjs/throttler` to rate-limit sensitive endpoints like login, password reset, registration, and OAuth callbacks to protect against brute-force attacks and credential stuffing. Apply stricter limits to auth endpoints.

## 5. Data Encryption & Environment Safety
- **At Rest & In Transit**: Supabase handles database-level encryption at rest, and all communication must run over HTTPS/TLS.
- **Secrets**: Never hardcode secrets. Always keep `DIRECT_URL` and `DATABASE_URL` secure in environment variables. Use `.env` locally and secret management in production.
- **Input Validation**: Use `class-validator` and `class-transformer` across all NestJS DTOs to strip unallowed fields and prevent SQL/NoSQL injection vectors. Enable global validation pipes with `whitelist: true` and `transform: true`.
