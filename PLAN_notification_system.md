# Portal Notification System — Implementation Plan (v2)

## Overview

Multi-channel notification system for coordinating 2000 concurrent Webex meetings.
- **Hosts** (2,000 — authenticated, portal access): In-App SSE + Email + SMS + WhatsApp
- **Participants** (up to 100,000 — no auth, no portal): Email only + host relay for WhatsApp
- **Cost per event**: ~$390 (vs ~$16K if messaging all participants on all channels)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    NOTIFICATION ENGINE                        │
│                                                               │
│  Event Bus (in-process) ──► Channel Dispatcher                │
│                                │                              │
│         ┌──────────┬───────────┼───────────┬──────────┐      │
│         ▼          ▼           ▼           ▼          ▼      │
│    ┌────────┐ ┌────────┐ ┌─────────┐ ┌────────┐ ┌───────┐  │
│    │In-App  │ │ Email  │ │   SMS   │ │WhatsApp│ │ Host  │   │
│    │  SSE   │ │  SES   │ │ Twilio  │ │ Meta   │ │ Relay │   │
│    │(hosts) │ │(all)   │ │(hosts)  │ │(hosts) │ │(free) │   │
│    └────────┘ └────────┘ └─────────┘ └────────┘ └───────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Step 1: Prisma Schema Changes

**File:** `prisma/schema.prisma`

### New Enums

```prisma
enum NotificationType {
  EVENT_ANNOUNCEMENT
  EVENT_STARTING_SOON
  EVENT_STARTED
  EVENT_ENDED
  MEETING_REMINDER
  MEETING_ISSUE
  UPLOAD_STATUS
  ADMIN_ALERT
  SYSTEM
  BROADCAST
}

enum NotificationSeverity {
  INFO
  WARNING
  URGENT
  CRITICAL
}

enum DeliveryChannel {
  IN_APP
  EMAIL
  SMS
  WHATSAPP
}

enum DeliveryStatus {
  PENDING
  QUEUED
  SENT
  DELIVERED
  FAILED
  BOUNCED
}

enum BroadcastStatus {
  DRAFT
  SCHEDULED
  SENDING
  SENT
  FAILED
}

enum BroadcastTarget {
  HOSTS_ONLY
  PARTICIPANTS_ONLY
  ALL
}
```

### New Models

```prisma
model Participant {
  id        String   @id @default(cuid())
  email     String
  name      String?
  phone     String?
  hostId    String
  host      User     @relation(fields: [hostId], references: [id], onDelete: Cascade)
  tenantId  String?
  tenant    Tenant?  @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  optedOut  Boolean  @default(false)
  createdAt DateTime @default(now())

  @@unique([email, hostId])
  @@index([hostId])
  @@index([tenantId])
}

model Notification {
  id         String               @id @default(cuid())
  userId     String
  user       User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenantId   String?
  tenant     Tenant?              @relation(fields: [tenantId], references: [id])
  type       NotificationType
  severity   NotificationSeverity @default(INFO)
  title      String
  body       String               @db.Text
  data       Json?
  actionUrl  String?
  read       Boolean              @default(false)
  readAt     DateTime?
  dismissed  Boolean              @default(false)
  deliveries NotificationDelivery[]
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt

  @@index([userId, read, createdAt])
  @@index([tenantId, createdAt])
}

model NotificationDelivery {
  id             String         @id @default(cuid())
  notificationId String
  notification   Notification   @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  channel        DeliveryChannel
  status         DeliveryStatus @default(PENDING)
  externalId     String?
  error          String?        @db.Text
  sentAt         DateTime?
  deliveredAt    DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([notificationId])
  @@index([status, channel])
}

model NotificationPreference {
  id      String          @id @default(cuid())
  userId  String
  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  channel DeliveryChannel
  enabled Boolean         @default(true)

  @@unique([userId, channel])
}

model NotificationTemplate {
  id       String           @id @default(cuid())
  slug     String           @unique
  type     NotificationType
  title    String
  body     String           @db.Text
  channels Json
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

model Broadcast {
  id          String          @id @default(cuid())
  tenantId    String?
  tenant      Tenant?         @relation(fields: [tenantId], references: [id])
  senderId    String
  sender      User            @relation(fields: [senderId], references: [id])
  target      BroadcastTarget @default(HOSTS_ONLY)
  title       String
  body        String          @db.Text
  channels    Json
  status      BroadcastStatus @default(DRAFT)
  totalCount  Int             @default(0)
  sentCount   Int             @default(0)
  failedCount Int             @default(0)
  scheduledAt DateTime?
  sentAt      DateTime?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([tenantId, status])
}
```

### Existing Model Updates

Add to `User`:
```prisma
  notifications           Notification[]
  notificationPreferences NotificationPreference[]
  broadcasts              Broadcast[]
  participants            Participant[]
```

Add to `Tenant`:
```prisma
  notifications Notification[]
  broadcasts    Broadcast[]
  participants  Participant[]
```

---

## Step 2: Notification Engine Core (Priority: High)

**New files:**

### `src/lib/notifications/engine.ts`
Central orchestrator with public API:
- `notify(userId, templateSlug, variables)` — single host notification
- `notifyMany(userIds[], templateSlug, variables)` — multiple hosts
- `broadcastToHosts(tenantId?, templateSlug, variables, channels[])` — all hosts (tenantId=null → ALL tenants)
- `broadcastToParticipants(tenantId?, templateSlug, variables)` — email-only to participants (tenantId=null → ALL tenants)
- `broadcastToAll(tenantId?, templateSlug, variables, hostChannels[])` — hosts (multi-channel) + participants (email)

**Cross-tenant broadcasting:** When `tenantId` is `null`, the engine queries ALL users/participants across ALL tenants. Any ADMIN or SUPERADMIN can broadcast globally regardless of their own tenant assignment.

Logic flow:
1. Resolve template by slug from DB
2. Interpolate `{{variables}}` into title/body
3. Check user notification preferences
4. Create Notification + NotificationDelivery records
5. Dispatch to channel handlers via `Promise.allSettled()`
6. Update delivery status on completion/failure

### `src/lib/notifications/template.ts`
- `renderTemplate(template, variables)` — Mustache-style interpolation
- `getTemplate(slug)` — fetch + cache from DB

### `src/lib/notifications/types.ts`
- Shared TypeScript types for the notification system

---

## Step 8: Real-Time In-App Notifications (SSE)

**New files:**

### `src/lib/notifications/sse-manager.ts`
Singleton managing SSE connections:
```typescript
class SSEManager {
  private clients: Map<string, Set<ReadableStreamController>>
  addClient(userId, controller): void
  removeClient(userId, controller): void
  sendToUser(userId, event): void
  broadcastToTenant(tenantId, event): void
}
```

### `src/app/api/notifications/stream/route.ts`
- `GET` — SSE endpoint (auth required)
- Sets `Content-Type: text/event-stream` headers
- 30s heartbeat keepalive
- Registers/deregisters in SSE manager

### `src/app/api/notifications/route.ts`
- `GET` — Paginated notification history (auth required)
  - Query params: `page`, `pageSize`, `unreadOnly`, `type`
- `PATCH` — Mark as read (single ID or `all`)

### `src/app/api/notifications/preferences/route.ts`
- `GET` — Current user's channel preferences
- `PUT` — Update preferences

---

## Step 9: In-App Notification UI (Hosts Only)

**New files:**

### `src/components/notifications/notification-bell.tsx` (Client Component)
- Bell icon with unread count badge
- Dropdown with recent notifications
- Connects to `/api/notifications/stream` SSE on mount
- Severity-based styling (INFO=blue, WARNING=amber, URGENT=orange, CRITICAL=red)

### `src/components/notifications/notification-list.tsx` (Client Component)
- Full paginated list with filters
- Mark as read, bulk actions
- Severity badges, relative timestamps

### `src/components/notifications/notification-toast.tsx` (Client Component)
- Toast popup for new URGENT/CRITICAL notifications from SSE
- Auto-dismiss 10s for INFO, persistent for CRITICAL
- Stacks up to 3 visible toasts

### `src/app/dashboard/notifications/page.tsx`
- Full notification center page
- Tabs: All | Unread | Urgent
- Notification preferences settings section

### Update: `src/components/site-header.tsx`
- Add `<NotificationBell />` next to auth buttons (for authenticated users only)

---

## AWS SES Setup Guide (Pre-Requisite for Step 3)

Complete these steps in the AWS Console BEFORE writing any code. SES requires domain verification and production access approval, which can take 24-48 hours.

### 1. Verify Your Sending Domain

Go to **AWS Console → SES → Verified Identities → Create Identity → Domain**

Enter your domain (e.g. `chinmayamission.org` or whatever domain you'll send from).

SES will generate DNS records you must add to your domain registrar:

**DKIM (3 CNAME records):**
```
selector1._domainkey.yourdomain.com → selector1.dkim.amazonses.com
selector2._domainkey.yourdomain.com → selector2.dkim.amazonses.com
selector3._domainkey.yourdomain.com → selector3.dkim.amazonses.com
```
(SES provides the exact values — copy them from the console)

**SPF (TXT record):**
```
Type: TXT
Name: yourdomain.com
Value: "v=spf1 include:amazonses.com ~all"
```

**DMARC (TXT record):**
```
Type: TXT
Name: _dmarc.yourdomain.com
Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com"
```

**Custom MAIL FROM (optional but recommended):**
```
Type: MX
Name: mail.yourdomain.com
Value: 10 feedback-smtp.us-east-1.amazonses.com

Type: TXT
Name: mail.yourdomain.com
Value: "v=spf1 include:amazonses.com ~all"
```

Allow **24 hours** for DNS propagation and SES verification.

### 2. Request Production Access (Exit Sandbox)

**Sandbox limits:** 200 emails/day, 1/sec, only to verified emails — unusable for 102K recipients.

Go to **AWS Console → SES → Account Dashboard → Request Production Access**

Fill in the form:
- **Mail type:** Transactional + Marketing
- **Website URL:** Your portal URL
- **Use case description:** Something like:
  > "We coordinate a global chanting event with 2,000 meeting hosts and up to 100,000 participants. We send event reminders, live event notifications, and post-event thank-you emails. All recipients are registered participants who joined through our event portal. We include unsubscribe links in all emails and process opt-outs immediately. We maintain bounce rates below 2%."
- **Expected daily volume:** 200,000 (peak event day)
- **How recipients sign up:** Via Webex meeting invitations / event registration
- **Bounce/complaint handling:** SNS topics + automatic suppression

AWS typically responds within **24 hours**. If denied, they'll tell you what to fix.

**After approval:** Default production limits are 50,000/day at 14/sec. Request a quota increase for event day:
- Go to **Service Quotas → SES → Sending quota** → Request increase to 200,000/day
- Request **sending rate** increase to 50/sec or higher

### 3. Set Up Bounce & Complaint Handling (Required)

Go to **SES → Verified Identities → your domain → Notifications tab**

Create two SNS topics:
- `ses-bounces` — for hard/soft bounces
- `ses-complaints` — for spam complaints

Assign them:
- **Bounce notifications** → `ses-bounces` SNS topic
- **Complaint notifications** → `ses-complaints` SNS topic

In the code (Step 3), we'll add a webhook endpoint that subscribes to these SNS topics to:
- Auto-mark bounced participant emails as `optedOut = true`
- Track complaint rates (must stay below 0.1%)
- Update `NotificationDelivery` status to `BOUNCED` or `FAILED`

**Critical thresholds:**
- Bounce rate > 5% → AWS reviews your account
- Bounce rate > 10% → AWS suspends sending
- Complaint rate > 0.1% → AWS reviews your account

### 4. Warm-Up Strategy for Event Day

Don't send 100K emails on day one. Ramp up gradually:

| Week | Daily Volume | Purpose |
|------|-------------|---------|
| Week 1 | 1,000 | Test emails to hosts (verified attendees) |
| Week 2 | 5,000 | Pre-event info to early-registered participants |
| Week 3 | 20,000 | Event reminder batch 1 |
| Week 4 | 50,000-100,000 | Full event-day blasts |

This builds sender reputation with email providers (Gmail, Outlook, etc.) and prevents being flagged as spam.

### 5. Cost Estimate

| Item | Cost |
|------|------|
| 100,000 emails | $10.00 |
| Data transfer (~60KB/email) | ~$0.70 |
| SNS notifications (bounces/complaints) | ~$0.05 |
| **Total per 100K blast** | **~$10.75** |
| Dedicated IP (optional, for reputation) | $24.95/month |

### 6. Environment Variables to Add

After SES is verified and production-approved, add to `.env`:
```
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
AWS_SES_FROM_NAME="Gita Chanting Event"
```

SES will reuse the existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from your S3 config — ensure that IAM user/role has SESv2 permissions.

**IAM policy to add (SES v2):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendBulkEmail",
        "ses:GetAccount",
        "ses:ListSuppressedDestinations",
        "ses:GetSuppressedDestination",
        "ses:PutSuppressedDestination",
        "ses:GetEmailIdentity",
        "ses:ListEmailIdentities"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note on SESv2 vs v1:** We use `@aws-sdk/client-sesv2` (the v2 API). Key differences:
- `SendEmailCommand` uses `FromEmailAddress` instead of `Source`
- `Content.Simple.Subject/Body` instead of `Message.Subject/Body`
- Built-in account-level suppression list (auto-manages bounces)
- `SendBulkEmailCommand` replaces `SendBulkTemplatedEmail`
- Both v1 and v2 share the same SES backend — domain identities work with both

---

## Step 3: Email Channel (AWS SES) (Priority: Highest)

**New files:**

### `src/lib/notifications/channels/email.ts`
- Uses `@aws-sdk/client-sesv2` (SES v2 API — cleaner interface, recommended by AWS)
- Uses `SESv2Client` + `SendEmailCommand` for single emails
- Uses `SendBulkEmailCommand` for batch sending (up to 50 destinations per call)
- SESv2 parameter style: `FromEmailAddress`, `Destination`, `Content.Simple.Subject/Body`
- Includes `ListUnsubscribe` header for one-click unsubscribe compliance
- Reuses existing AWS credentials from S3 config
- HTML template wrapper with brand styling
- Unsubscribe link in footer (for participants)

### `src/lib/notifications/channels/email-templates.ts`
- HTML email layout matching portal brand colors (#3b1a1f, #fbe9c6, #d8792d)
- Responsive email template (inline CSS)
- `renderEmailHtml(title, body, actionUrl?, unsubscribeUrl?)` — returns full HTML

### `src/app/api/unsubscribe/[token]/route.ts`
- `GET` — Public endpoint (no auth)
- Decodes token → participant email
- Sets `optedOut = true` on Participant record
- Returns simple confirmation page

### `src/app/api/webhooks/ses/route.ts`
- `POST` — SNS webhook for SES bounce/complaint notifications
- Handles SNS subscription confirmation
- On bounce: marks participant `optedOut = true`, updates delivery status to `BOUNCED`
- On complaint: marks participant `optedOut = true`, updates delivery status to `FAILED`
- Logs all events for monitoring

**New dependency:** `@aws-sdk/client-sesv2`

**New env vars:**
```
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
AWS_SES_FROM_NAME="Gita Chanting Event"
```

---

## Step 4: Participant Sync (Priority: High)

Admin clicks a **"Sync Participants"** button on the admin dashboard. The system pulls all meeting invitees from the existing FastAPI backend and upserts them into the `Participant` table.

**New files:**

### `src/app/api/admin/participants/sync/route.ts`
- `POST` — Trigger participant sync (ADMIN/SUPERADMIN)
  - Calls FastAPI backend at `ADMINSITE_URL` (already in `.env`)
  - `GET /meetings/users?client_name=X` → get all hosts and their meetings
  - `GET /meetings/invitees/{meeting_id}?client_name=X` → get invitees per meeting
  - Upserts each invitee into `Participant` table (email, name, hostId, tenantId)
  - Returns `{ synced: number, created: number, skipped: number }`

### `src/app/api/admin/participants/route.ts`
- `GET` — List participants with counts (ADMIN/SUPERADMIN)
  - Query: `?page=1&pageSize=50&tenantId=X`
  - Returns total count, opted-out count, per-host counts

### `src/lib/notifications/participant-sync.ts`
- `syncParticipantsFromWebex()` — Fetches from FastAPI, matches host emails to User records, upserts Participant rows

### Admin Dashboard UI Addition
- Add **"Sync Participants"** button to existing `/dashboard/admin` page
- Shows last sync timestamp + total participant count
- Button triggers `POST /api/admin/participants/sync`
- Shows progress/result toast on completion

---

## Step 5: Unsubscribe Endpoint (Priority: High — Legal Requirement)

Required before sending any bulk email to participants (CAN-SPAM / SES policy).

### `src/app/api/unsubscribe/[token]/route.ts`
- `GET` — Public endpoint (no auth required)
- Decodes signed token → participant email + hostId
- Sets `optedOut = true` on Participant record
- Returns a simple branded confirmation page ("You've been unsubscribed")
- Token signed with `UNSUBSCRIBE_SECRET` env var using HMAC-SHA256

### `src/lib/notifications/unsubscribe.ts`
- `generateUnsubscribeToken(email, hostId)` — creates signed token
- `verifyUnsubscribeToken(token)` — validates and decodes
- Used by email channel to append unsubscribe link to every participant email

---

## Step 10: Host Message Relay Panel

**New files:**

### `src/app/dashboard/relay/page.tsx`
- Shows current active announcement from admin
- Pre-formatted message with host-specific details auto-filled:
  - Host name, meeting link, meeting time
- "Copy to clipboard" button
- Multiple formats: WhatsApp (with bold/italic), plain text, email
- Acknowledgment button ("I've shared this with my participants")

### `src/app/api/relay/route.ts`
- `GET` — Get current active relay message for this host
- `POST` — Mark as acknowledged by host

### `src/app/api/relay/status/route.ts` (ADMIN)
- `GET` — Relay acknowledgment dashboard
  - How many hosts have acknowledged
  - List of hosts who haven't yet

---

## Step 6: Admin Broadcast Panel (Priority: High)

**New files:**

### `src/app/dashboard/admin/broadcast/page.tsx`
- Compose form: title, body, severity
- **Scope selector:** All Tenants (global) | Specific Tenant (dropdown)
  - Any ADMIN/SUPERADMIN can select "All Tenants" to broadcast globally
  - Tenant filter is optional — null means all tenants
- Target selector: Hosts Only | Participants Only | All
- Channel checkboxes (hosts): IN_APP, EMAIL, SMS, WHATSAPP
- Participants always get EMAIL only
- Preview before send (shows estimated recipient count)
- Broadcast history table with delivery stats

### Quick-Send Buttons (on admin dashboard or broadcast page)
Pre-wired buttons for event-day scenarios:
- "30 min warning" → `event-starting-30min` to all hosts (all channels)
- "Event is LIVE" → `event-started` to all hosts (all channels) + all participants (email)
- "Technical issue" → compose with URGENT severity pre-filled
- "Event complete" → `event-ended` to all (email)
- "Upload reminder" → `upload-reminder` to hosts (in-app + email)

### `src/app/api/admin/broadcast/route.ts`
- `POST` — Create and dispatch broadcast
- `GET` — List broadcast history with stats

### `src/app/api/admin/broadcast/[id]/route.ts`
- `GET` — Broadcast detail with per-channel delivery breakdown

---

## Step 11: SMS Channel (Twilio) — Hosts Only

**New files:**

### `src/lib/notifications/channels/sms.ts`
- Uses `twilio` SDK
- `sendSms(to, body)` — single SMS
- `sendBulkSms(recipients[], body)` — via Messaging Service
- Delivery status tracking

### `src/app/api/webhooks/twilio/route.ts`
- Delivery status callback webhook
- Updates NotificationDelivery status

**New dependency:** `twilio`

**New env vars:**
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=
```

---

## Step 12: WhatsApp Channel (Meta API) — Hosts Only

**New files:**

### `src/lib/notifications/channels/whatsapp.ts`
- Uses WhatsApp Business Cloud API (HTTP fetch, no extra SDK)
- Pre-approved message templates (required by Meta policy)
- `sendWhatsApp(to, templateName, variables)` — single message
- `sendBulkWhatsApp(recipients[], templateName, variables)` — batch

### `src/app/api/webhooks/whatsapp/route.ts`
- Delivery + read receipt webhook
- Webhook verification (GET handler)
- Updates NotificationDelivery status

**New env vars:**
```
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
```

---

## Step 7: Template Seeding (Priority: High)

**Update:** `prisma/seed.ts`

Add notification template seeding:

| Slug | Type | Title | Channels |
|------|------|-------|----------|
| `event-starting-30min` | EVENT_STARTING_SOON | Event starts in 30 minutes | IN_APP, EMAIL, SMS, WHATSAPP |
| `event-starting-5min` | EVENT_STARTING_SOON | Event starts in 5 minutes! | IN_APP, EMAIL, SMS, WHATSAPP |
| `event-started` | EVENT_STARTED | Event is LIVE | IN_APP, EMAIL, SMS, WHATSAPP |
| `event-ended` | EVENT_ENDED | Event complete — thank you! | IN_APP, EMAIL |
| `meeting-issue` | MEETING_ISSUE | Issue with your meeting | IN_APP, EMAIL, WHATSAPP |
| `upload-reminder` | UPLOAD_STATUS | Please upload your recording | IN_APP, EMAIL |
| `upload-success` | UPLOAD_STATUS | Recording uploaded | IN_APP |
| `upload-failed` | UPLOAD_STATUS | Upload failed | IN_APP, EMAIL |
| `participant-event-reminder` | EVENT_STARTING_SOON | Your chanting event starts soon | EMAIL |
| `participant-event-live` | EVENT_STARTED | Event is LIVE — join now | EMAIL |
| `participant-event-thanks` | EVENT_ENDED | Thank you for participating | EMAIL |
| `general-announcement` | BROADCAST | {{custom_title}} | Configurable |

---

## Cost Summary Per Event

| Action | Target | Channel | Cost |
|--------|--------|---------|------|
| Event reminders (3x) | 2,000 hosts | IN_APP + Email + SMS + WhatsApp | ~$360 |
| Event reminders (2x) | 100,000 participants | Email (SES) | ~$20 |
| Emergency alerts | 2,000 hosts | SMS + WhatsApp | ~$120 |
| Emergency alerts | 100,000 participants | Via host relay | $0 |
| Post-event | 102,000 all | Email | ~$10 |
| **Total** | | | **~$510** |

---

## New Dependencies Summary

```
@aws-sdk/client-sesv2    # Email (SES already in AWS ecosystem)
twilio                 # SMS (hosts only)
```

## New Env Vars Summary

```
# Email (SES)
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
AWS_SES_FROM_NAME="Gita Chanting Event"

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=

# WhatsApp (Meta)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=

# Unsubscribe token signing
UNSUBSCRIBE_SECRET=replace-with-random-secret
```

---

## Implementation Order

Email is prioritized first — it's the only channel that reaches both hosts (2,000) and participants (100,000), giving the highest value earliest.

| # | Step | Scope | Why this order |
|---|------|-------|----------------|
| 1 | Prisma schema + migration (all models) | Schema only | Foundation for everything |
| 2 | Notification engine core + types + template renderer | `src/lib/notifications/` | Orchestrator needed before any channel |
| 3 | Email channel (SES) + branded email templates | Email infra | Reaches ALL 102K users — highest impact channel |
| 4 | Participant import + sync from Webex | Data layer | Need participant emails before we can email them |
| 5 | Unsubscribe endpoint (public, no auth) | Email compliance | Legal requirement before sending bulk email |
| 6 | Admin broadcast panel + quick-send buttons | Frontend + API | Admin can now email all hosts + participants |
| 7 | Template seeding in seed.ts | Seed script | Pre-built templates ready for broadcast panel |
| 8 | SSE manager + stream API route | Real-time infra | Add real-time layer for hosts |
| 9 | In-app notification UI (bell, list, toast) + dashboard page | Frontend | Hosts get in-portal notifications |
| 10 | Host relay panel + acknowledgment tracking | Frontend + API | Free WhatsApp reach via hosts |
| 11 | SMS channel (Twilio) + webhook — hosts only | SMS infra | Urgent alerts for hosts |
| 12 | WhatsApp channel (Meta API) + webhook — hosts only | WhatsApp infra | Direct WhatsApp for hosts |

**Milestone after Step 7:** You can broadcast email to all 102K people and use quick-send buttons on event day. This is a fully functional notification system for ~$10/broadcast.

**Milestone after Step 10:** Hosts get real-time in-app notifications + relay panel. Full event-day coordination without SMS/WhatsApp spend.

**Milestone after Step 12:** All channels live. Full system operational.
