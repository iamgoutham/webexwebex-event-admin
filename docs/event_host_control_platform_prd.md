# Product Requirements Document (PRD)

## Project Name
**Event Host Control Platform** (working name)

## Overview
The Event Host Control Platform is a web-based, multi-tenant administration dashboard designed to manage large-scale Webex-hosted meetings (2,000+ concurrent meetings). It enables meeting hosts to authenticate using Webex OAuth, access their assigned meeting details, manage local recording uploads to AWS S3, and follow standardized operational workflows. The platform supports role-based access control (RBAC), multi-Webex-domain tenancy, secure session management, and Super Admin governance.

---

## Goals & Objectives
- Support mass creation and management of Webex meetings
- Provide hosts a single dashboard for meeting links, assets, and uploads
- Enable secure upload of locally recorded meetings to AWS S3
- Enforce multi-tenant isolation across Webex organizations
- Provide robust admin and super admin controls
- Ensure secure authentication, authorization, and session handling

---

## User Roles

### 1. Host (Default Role)
- Assigned automatically to all users on first login
- View assigned meeting link
- Launch Webex meeting via browser
- Upload local recording to S3
- View profile details and shortId
- Access instructions for participants
- Access OBS setup instructions
- Download background video assets

### 2. Admin
- All Host permissions
- View users within same Webex org (tenant)
- Promote/demote users to Admin (within org)
- View upload status and meeting metadata

### 3. Super Admin
- System-level role (seeded initially)
- Cross-tenant visibility
- Promote/demote users to Admin or Super Admin
- Assign/reassign meetings to hosts
- Manage global settings
- View audit logs
- Manage tenant-level configurations

---

## Multi-Tenancy Model
- Each tenant corresponds to a **Webex Organization (orgId)**
- orgId is derived from Webex OAuth profile
- All data (users, meetings, uploads) is scoped to orgId
- Super Admin can access all tenants
- Tenant isolation enforced at API and database layers

---

## Authentication & Session Management

### Authentication
- Webex OAuth 2.0 login
- Fetch user profile, email, Webex userId, orgId
- Upsert user into local database

### Session Management
- JWT-based authentication
- Access Token (15 minutes)
- Refresh Token (7–30 days)
- Tokens stored in **HTTP-only secure cookies**
- No use of localStorage

### JWT Claims
- userId (sub)
- orgId
- role (HOST | ADMIN | SUPER_ADMIN)
- shortId

### Session Persistence
- Refresh tokens hashed and stored in MySQL via Prisma
- Token rotation on refresh
- Logout revokes session immediately

---

## Core Features

### Host Dashboard
- Display:
  - Assigned meeting link
  - Button to launch Webex meeting
  - ShortId to be embedded in video
  - Clock overlay link for OBS
  - Background video download link
- Upload button for recorded video (S3 pre-signed URL)
- Upload progress and status

### Instructions Pages

#### Participant Instructions Page
- Host-facing page with standardized instructions to share
- Covers:
  - Joining Webex
  - Audio/video etiquette
  - Recording disclaimers

#### OBS Setup Page
- Step-by-step guide for OBS configuration
- Includes:
  - Scene setup
  - Audio/video sources
  - Embedding shortId and clock
  - Background video usage

---

## Admin Features
- User list (tenant-scoped)
- Promote/demote users to Admin
- View meeting assignments
- Monitor upload completion

---

## Super Admin Features
- Cross-tenant user management
- Assign/remove Admin roles
- Seed and manage initial Super Admin
- Manage meetings across tenants
- View system-wide audit logs

### Initial Super Admin Seed Logic
- On first application boot:
  - Read SUPER_ADMIN_EMAIL from env
  - If no Super Admin exists:
    - Create user with SUPER_ADMIN role
- Prevent deletion of last Super Admin

---

## Recording Uploads (AWS S3)
- Hosts record meetings locally
- Upload via dashboard using pre-signed S3 URLs
- Multipart upload for large files
- Metadata stored in DB (userId, orgId, meetingId, timestamp)

---

## Security Requirements
- HTTPS enforced
- Secure cookies (HttpOnly, SameSite=Lax)
- CSRF protection
- Rate limiting on auth endpoints
- Audit logging:
  - Login
  - Logout
  - Role changes
  - Upload actions

---

## Technology Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS

### Backend
- Next.js API Routes
- Prisma ORM
- MySQL (self-hosted on AWS EC2)

### Auth & Security
- Webex OAuth
- JWT (jsonwebtoken)
- Secure cookies

### Infrastructure
- AWS EC2 (Apache reverse proxy)
- AWS S3 (recording storage)
- Let’s Encrypt SSL

---

## Non-Functional Requirements
- Scalable to 2,000+ concurrent meetings
- Horizontally scalable backend
- Stateless access tokens
- Works behind Apache reverse proxy
- Observability and logging enabled

---

## Acceptance Criteria
- Users can log in via Webex
- Correct role assigned by default (Host)
- Session persists across reloads
- Uploads complete successfully to S3
- Tenant isolation enforced
- Super Admin can manage roles
- Instructions and OBS pages accessible

---

## Future Enhancements (Out of Scope)
- Zoom / Teams support
- Live streaming
- Automated meeting creation
- Transcoding or post-processing

---

## Status
**PRD Version:** v1.0
**Audience:** Engineering, Product, Stakeholders
