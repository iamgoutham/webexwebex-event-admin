# Webex Event Admin (Next.js 14)

Production-ready Webex admin console with Prisma + MySQL, OAuth authentication,
tenant-scoped RBAC, presigned S3 uploads, and admin dashboards. The app is built
for EC2 deployments behind an Apache reverse proxy.

## Features

- Webex OAuth authentication via Auth.js (NextAuth)
- Multi-tenant RBAC: `HOST` default, `ADMIN` tenant-scoped, `SUPERADMIN` global
- Prisma schema, seed scripts, and MySQL storage
- AWS S3 presigned upload API for secure asset ingestion
- Admin + SuperAdmin dashboards and API routes
- Security guards for API and server component access

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Prisma + MySQL
- Auth.js (NextAuth) + Webex OAuth
- AWS SDK v3 (S3 presigned URLs)

## Setup

1. Install dependencies:

```
npm install
```

2. Configure environment variables:

```
cp .env.example .env
```

3. Create the database and run Prisma:

```
npm run db:generate
npm run db:migrate
npm run db:seed
```

4. Start the dev server:

```
npm run dev
```

## Webex OAuth

Register a Webex OAuth integration with the redirect URL:

```
https://<your-domain>/api/auth/callback/webex
```

Set `WEBEX_CLIENT_ID`, `WEBEX_CLIENT_SECRET`, and optional `WEBEX_SCOPES`
(`spark:people_read` by default).

## RBAC Model

- `HOST` (default): basic access to the dashboard
- `ADMIN`: tenant-scoped admin actions (users, uploads)
- `SUPERADMIN`: global admin actions (tenants, cross-tenant access)

Role and tenant checks are enforced in:

- Server components via `requireAuth`/`requireRole`
- API routes via `requireApiAuth` and `hasTenantAccess`

## API Routes

| Route | Method | Role | Description |
| --- | --- | --- | --- |
| `/api/me` | GET | Authenticated | Current session payload |
| `/api/tenants` | GET/POST | SuperAdmin | List/create tenants |
| `/api/tenants/:tenantId` | GET | Admin, SuperAdmin | Tenant details |
| `/api/users` | GET/POST | Admin, SuperAdmin | Tenant user management |
| `/api/uploads/presign` | POST | Admin, SuperAdmin | S3 presigned URL |

## Seed Data

Seed behavior is controlled by `.env`:

- `SEED_TENANT=true` creates the default tenant
- `SEED_SUPERADMIN_EMAIL` creates the global SuperAdmin
- `SEED_ADMIN_EMAIL` creates a tenant Admin (requires tenant)

## Apache Reverse Proxy (EC2)

Example Apache configuration:

```
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Port "443"
```

Ensure `NEXTAUTH_URL` matches the public domain, and set
`NEXTAUTH_SECRET` to a strong value. For EC2 deployments, build with

```
npm run build
```

and run with

```
npm run start
```
