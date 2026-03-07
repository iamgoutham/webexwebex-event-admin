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
| `/api/uploads/complete` | POST | Admin, SuperAdmin | Complete multipart upload |
| `/api/verify-email` | GET | Secret | Check if email is a host or participant (see below) |

### Verify email (public API with secret)

`GET /api/verify-email?email=...` returns whether the email is registered as a host and/or participant. No login required; protect with a shared secret.

- **Auth:** Set `VERIFY_EMAIL_SECRET` in the environment. Callers must send it via:
  - `Authorization: Bearer <VERIFY_EMAIL_SECRET>`, or
  - `x-verify-email-secret: <VERIFY_EMAIL_SECRET>`
- **Response:** `{ isHostOrParticipant: boolean, host: boolean, participant: boolean }`
- If `VERIFY_EMAIL_SECRET` is not set, the endpoint returns 503.

## Cron jobs (Vercel)

A scheduled task runs every 2 hours to sync hosts and participants from Google Sheets (same logic as the “Sync Hosts” and “Sync Participants” buttons on the Broadcast page).

- **Endpoint:** `GET /api/cron/sync-hosts-and-participants`
- **Schedule:** `0 */2 * * *` (every 2 hours; configured in `vercel.json`)
- **Auth:** Set `CRON_SECRET` in Vercel environment variables. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. For external cron services, you can use the header `x-cron-secret: <CRON_SECRET>`.

If `CRON_SECRET` is not set, the endpoint returns 503.

### Cron on AWS (EventBridge + Lambda)

Use EventBridge to run every 2 hours and a small Lambda that calls your app’s cron URL with the secret.

1. **Set `CRON_SECRET`** in your app’s environment (e.g. EC2 user data, ECS task def, or Parameter Store). Use a long random string (e.g. 32+ chars).

2. **Create a Lambda** (Node 18+):
   - **Runtime:** Node.js 18.x or 20.x
   - **Code:** Use the following handler. Replace `CRON_URL` with your app’s base URL (e.g. `https://your-domain.com`).

   ```javascript
   const https = require('https');
   const url = new URL(process.env.CRON_URL + '/api/cron/sync-hosts-and-participants');

   exports.handler = async () => {
     const secret = process.env.CRON_SECRET;
     if (!secret) throw new Error('CRON_SECRET not set');
     return new Promise((resolve, reject) => {
       const req = https.request(url, { method: 'GET', headers: { 'x-cron-secret': secret } }, (res) => {
         let body = '';
         res.on('data', (c) => body += c);
         res.on('end', () => {
           if (res.statusCode >= 400) reject(new Error(`Cron failed: ${res.statusCode} ${body}`));
           else resolve({ statusCode: 200, body });
         });
       });
       req.on('error', reject);
       req.end();
     });
   };
   ```

   **Lambda env vars:**  
   - `CRON_URL` = your app URL (e.g. `https://your-domain.com`)  
   - `CRON_SECRET` = same value as in your app (store in Lambda env or use Secrets Manager).

3. **Create an EventBridge rule:**
   - **Schedule:** `cron(0 */2 * * * ? *)` (every 2 hours, on the hour)
   - **Target:** the Lambda above
   - Enable the default permission so EventBridge can invoke the Lambda.

4. **Optional:** If your app is in a private VPC and not reachable from the internet, run the cron from the same network (e.g. use the app’s internal URL for `CRON_URL`, and put the Lambda in the same VPC with access to that URL), or use the EC2 crontab option below.

### Cron on AWS (EC2 crontab)

If the app runs on an EC2 instance, you can trigger the cron from the same server with `curl`.

1. **Set `CRON_SECRET`** in your app’s environment (e.g. in `.env` or the process manager’s env).

2. **On the EC2 instance**, add a crontab entry (run `crontab -e` as the app user or root):

   ```bash
   0 */2 * * * curl -sf -H "x-cron-secret: YOUR_CRON_SECRET" "http://127.0.0.1:3000/api/cron/sync-hosts-and-participants" || true
   ```

   Replace `YOUR_CRON_SECRET` with the same value as `CRON_SECRET` in your app. Using `127.0.0.1` avoids going through the public URL. If the app listens on a different port, change `3000` accordingly.

3. **Optional:** Store the secret in a file with restricted permissions and source it:

   ```bash
   0 */2 * * * curl -sf -H "x-cron-secret: $(cat /etc/app/CRON_SECRET)" "http://127.0.0.1:3000/api/cron/sync-hosts-and-participants" || true
   ```

### Amazon Linux

On Amazon Linux 2 or 2023, cron is provided by `crond`. Ensure it’s running:

```bash
sudo systemctl enable crond
sudo systemctl start crond
sudo systemctl status crond
```

Then add your cron job with the same entry as above:

```bash
crontab -e
# Add:
# 0 */2 * * * curl -sf -H "x-cron-secret: YOUR_CRON_SECRET" "http://127.0.0.1:3000/api/cron/sync-hosts-and-participants" || true
```

Use `crontab -l` to list jobs. Logs: `sudo tail -f /var/log/cron` (Amazon Linux 2) or `journalctl -u crond -f` (Amazon Linux 2023).

## Multipart uploads

- `POST /api/uploads/presign` expects `filename`, `contentType`, `partCount`,
  and optional `folder`. The response includes `uploadId`, `key`, and
  pre-signed part URLs.
- `POST /api/uploads/complete` finalizes the upload with the `uploadId`, `key`,
  and each part’s `ETag`.
- Uploaded object keys include the user `shortId` for traceability.

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
