# FixFlow — Open-Source CMMS & Maintenance Ticketing Platform

> Self-hosted **CMMS (GMAO)** and **maintenance ticketing** software to declare incidents, auto-route work orders, run preventive maintenance, and track equipment, spare parts, costs and reliability — built with Next.js, Prisma and PostgreSQL.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-149eca)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2d3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed)
![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue)

**FixFlow is a free, open-source CMMS (Computerized Maintenance Management System — *GMAO* in French) and maintenance ticketing platform.** Teams declare incidents, work orders are auto-assigned to the owning team, and the tool covers the full maintenance lifecycle: corrective and preventive maintenance, an equipment registry, spare-parts inventory, time and cost tracking, reliability KPIs (MTBF/MTTR), and configurable authentication (LDAP or Microsoft Entra ID) and email — all self-hosted.

- **Category:** CMMS / GMAO + maintenance ticketing / work-order management
- **Deployment:** self-hosted (Docker in dev, Node.js standalone in production)
- **Stack:** Next.js 15 (App Router) · React 19 · Prisma · PostgreSQL · NextAuth
- **Status:** actively developed · 10 GMAO modules delivered

---

## Table of contents

- [What is FixFlow?](#what-is-fixflow)
- [Key capabilities](#key-capabilities)
  - [Maintenance ticketing & work orders](#-maintenance-ticketing--work-orders)
  - [GMAO / CMMS — asset & maintenance management](#-gmao--cmms--asset--maintenance-management)
  - [Analytics & reliability](#-analytics--reliability)
  - [Configuration & administration](#️-configuration--administration)
- [Who is it for?](#who-is-it-for)
- [Roles & access control](#roles--access-control)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start-docker)
- [Configuration](#configuration)
- [Deployment, backups & hardening](#deployment-backups--hardening)
- [Documentation](#documentation)
- [FAQ](#faq)
- [License](#license)

---

## What is FixFlow?

FixFlow is maintenance management software that combines a **ticketing / help-desk workflow** with a full **CMMS (GMAO)**. A requester declares an incident on a piece of equipment; FixFlow generates a structured report, creates a work order (ticket), and auto-assigns it to the team that owns the equipment. From there, technicians handle corrective work, managers schedule preventive maintenance, and administrators track parts, costs, suppliers and reliability.

It is designed for organizations that outgrew spreadsheets and email threads but don't want a heavy, expensive SaaS: **FixFlow is self-hosted, data stays in your PostgreSQL database, and everything is configurable from the admin backoffice.**

> **GMAO vs CMMS:** *GMAO* (Gestion de Maintenance Assistée par Ordinateur) is the French term for a *CMMS* (Computerized Maintenance Management System). FixFlow is both — a bilingual, open-source GMAO/CMMS.

---

## Key capabilities

### 🎫 Maintenance ticketing & work orders

- **Incident declaration** with an auto-generated report, attached to a specific piece of equipment.
- **Automatic routing** — each ticket is assigned to the team that owns the equipment.
- **Kanban board** with drag-and-drop status changes; **statuses are customizable per team** (order + final states).
- **Priority & SLA** — P1/P2/P3 priorities, first-response and resolution deadlines, corrective vs. improvement vs. preventive nature.
- **Quotes & billing** — request/track external quotes (devis), quote/invoice numbers, SLA on quote reception.
- **Threaded chat** on every ticket with **photo/PDF attachments**.
- **Visibility control** — subscriptions, user groups, and role-based access so each user only sees what they should.
- **Requests workflow (demandes)** — validation of access/declaration requests by site managers.
- **Notifications** — in-app bell + email, due-date reminders, and admin alerts for access requests.

### 🏭 GMAO / CMMS — asset & maintenance management

Ten delivered modules cover the full maintenance scope:

| Module | What it does |
|--------|--------------|
| **Equipment registry** | Assets with unique reference codes, categories, locations, photos, documents, and **QR codes**. |
| **Preventive & regulatory maintenance** | Recurring maintenance plans, schedules, regulatory controls, and certificate expiry tracking. |
| **Spare parts & stock** | Parts catalog, stock levels, reorder points, stock movements, and **low-stock alerts**. |
| **Time & costs** | Work logs, labor rate, cost lines, and per–work-order cost computation. |
| **Reliability KPIs** | **MTBF**, **MTTR**, availability, and preventive-maintenance compliance. |
| **Technicians & skills** | Internal technicians, skills/certifications, and work-order assignment. |
| **Planning** | Dispatch board to schedule interventions across technicians. |
| **Hierarchy & meters** | Equipment hierarchy, meter readings, and meter-based maintenance triggers. |
| **Suppliers & contracts** | External maintainers/contractors and maintenance contracts. |
| **Mobile, QR & signature** | Installable **PWA**, QR-code scanning, and on-site intervention signature capture. |
| **Floor plans** | Upload floor plans (incl. a **DWG/DXF converter**), place equipment, and open its kanban from the map. |

### 📊 Analytics & reliability

- Operational dashboards: ticket volume, resolution rate, average resolution time, open-backlog over time.
- Reliability dashboard: **MTBF / MTTR / availability / preventive compliance** per equipment and team.
- Breakdown by **site, team, equipment, status and priority**; quote-SLA and priority-change metrics.
- Manual **CSV / PDF exports**.

### ⚙️ Configuration & administration

Everything below is configured from the **admin backoffice** — no redeploy needed for most changes:

- **Authentication, your choice of SSO** — **LDAP / Active Directory** or **Microsoft Entra ID (Azure AD)**, switchable from the UI. A local admin account is always available as a break-glass login.
- **Role management in the UI** — roles (ADMIN / MANAGER / MAINTAINER / BASIC) are assigned in the backoffice, not derived from AD groups. New SSO users land in a **pending-access** state until an admin grants access.
- **Email (SMTP) configuration** — host, port, security (**STARTTLS / SSL / none**), authentication, and sender — with a **"send test email"** button. Password stays in environment variables.
- **Teams, statuses & SLA**, **locations (sites)**, **equipment categories & access rights**, **user groups**, and global SLA/labor-rate settings.
- **Security built in** — CSP headers, HSTS in production, login throttling, strict per-ticket access control, and attachment validation (MIME, size, count).

---

## Who is it for?

FixFlow fits any team that maintains physical assets and wants a self-hosted, configurable CMMS/GMAO instead of paper, spreadsheets, or a per-seat SaaS:

- **Facilities & building management** — HVAC, elevators, access control, multi-site portfolios.
- **Manufacturing & industrial maintenance** — machines, preventive plans, spare parts, MTBF/MTTR.
- **Property & real-estate management** — incidents per site, external contractors, quotes.
- **IT & equipment fleets** — asset registry, QR tagging, corrective tickets.
- **Internal maintenance / technical services** — a shared ticketing + work-order backbone for a whole organization.

---

## Roles & access control

| Role | Can do |
|------|--------|
| **ADMIN** | Full backoffice: statuses, roles & access, auth/email configuration, exports. |
| **MANAGER** | Backoffice (sites, equipment, groups), request validation, exports; sees everything. |
| **MAINTAINER** | Technician: handles the work orders they're subscribed to (chat, attachments). |
| **BASIC** | Declares incidents; sees only their subscriptions / group-accessible teams. |

Access is managed in the UI; new SSO users require admin approval before they can enter.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS |
| Backend | Next.js Server Actions + Route Handlers |
| Database | PostgreSQL 15 + Prisma ORM |
| Auth | NextAuth.js — LDAP / Microsoft Entra ID + local accounts |
| Dev environment | Docker Compose (app, PostgreSQL, Adminer, Mailpit) |
| Production | Node.js standalone (no Docker required) |

---

## Quick start (Docker)

```bash
# 1. Configure the environment
cp .env.example .env
# Edit .env (database, NEXTAUTH_SECRET, BOOTSTRAP_ADMIN_PASSWORD, SSO/SMTP as needed)

# 2. Start the services (app, PostgreSQL, Adminer, Mailpit)
docker compose up --build -d

# 3. Initialize the database
docker compose exec app npm run prisma:generate
docker compose exec app npm run prisma:migrate
docker compose exec app npm run prisma:seed

# 4. Open the app
# http://localhost:3000  — FixFlow
# http://localhost:8080  — Adminer (database UI)
# http://localhost:8025  — Mailpit (dev email inbox)
```

The seed creates a single local **admin** account (`admin@example.com`, password from `BOOTSTRAP_ADMIN_PASSWORD`) plus demo sites and a sample work order. Sign in, then configure SSO, email and roles from the backoffice.

---

## Configuration

Most configuration lives in the **backoffice** (auth, email, teams, statuses, SLA, locations, categories, groups). Secrets and infrastructure settings live in `.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | Session signing + base URL |
| `BOOTSTRAP_ADMIN_EMAILS` | Emails auto-promoted to ADMIN on first SSO login |
| `BOOTSTRAP_ADMIN_PASSWORD` | Seeded local admin password (break-glass) |
| `LDAP_BIND_PASSWORD` | LDAP service-account secret (non-secret LDAP settings are in the UI) |
| `ENTRA_CLIENT_SECRET` | Microsoft Entra client secret (tenant/client IDs are in the UI) |
| `SMTP_PASSWORD` | SMTP password (host/port/from/security are in the UI) |

See **[docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)** for the full SSO, roles and troubleshooting guide.

---

## Deployment, backups & hardening

**Production deployment (no Docker)** — the included script syncs `app/`, builds, runs `prisma migrate deploy`, prepares the Next.js standalone runtime, restarts the systemd service, and runs a security preflight:

```bash
sh scripts/deploy-remote.sh --help
```

**Backups** — timestamped `pg_dump` with checksums:

```bash
npm run db:backup          # create a backup
npm run db:backup:list     # list backups
npm run db:restore -- ./backups/db/<file>.dump
```

**WAN hardening (recommended for internet exposure):**

```env
DEV_AUTH_BYPASS=false
NEXT_PUBLIC_DEV_AUTH_BYPASS=false
ALLOWED_HOSTS=fixflow.example.com
FORCE_HTTPS=true
NEXTAUTH_URL=https://fixflow.example.com
NEXTAUTH_SECRET=<long-random-secret>
```

Already applied by the project: security headers (CSP, HSTS in prod, no-sniff, frame-deny), login throttling, strict ticket access control, and attachment validation.

---

## Documentation

| Doc | Content |
|-----|---------|
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | SSO (LDAP / Microsoft Entra), roles, bootstrap, troubleshooting |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Prisma data model + setup |
| [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md) | Database schema reference |
| [docs/PWA_TECHNICIEN_SECURITY.md](docs/PWA_TECHNICIEN_SECURITY.md) | External maintainer PWA security model |

---

## FAQ

### What is FixFlow?
FixFlow is an open-source **CMMS (GMAO)** and maintenance ticketing platform. It manages incident tickets, work orders, equipment, preventive maintenance, spare parts, costs and reliability KPIs, and is self-hosted on Next.js, Prisma and PostgreSQL.

### What's the difference between a CMMS and a GMAO?
None — *GMAO* (Gestion de Maintenance Assistée par Ordinateur) is simply the French term for a *CMMS* (Computerized Maintenance Management System). FixFlow is a bilingual GMAO/CMMS.

### Is FixFlow free and open-source?
Yes. FixFlow is open-source under the **AGPL-3.0** license and self-hosted — you run it on your own infrastructure and your data stays in your PostgreSQL database. A **commercial license** is also available for closed-source or proprietary use (see [License](#license)).

### Can FixFlow be self-hosted?
Yes. Docker Compose is provided for development, and a production deployment script builds a Node.js standalone runtime and manages a systemd service — no Docker required in production.

### Does FixFlow support SSO (LDAP or Microsoft Entra / Azure AD)?
Yes. You choose the active SSO method — **LDAP / Active Directory** or **Microsoft Entra ID (Azure AD)** — from the admin backoffice. A local admin account is always available, and roles are managed in the UI.

### Does FixFlow handle preventive maintenance?
Yes. It supports recurring preventive and regulatory maintenance plans, schedules, certificate-expiry tracking, and meter-based maintenance triggers, in addition to corrective (incident) tickets.

### Does FixFlow manage spare-parts inventory?
Yes. There is a parts catalog with stock levels, reorder points, stock movements, and automatic low-stock alerts, plus parts consumption on work orders.

### What reliability metrics does FixFlow compute?
It computes **MTBF** (mean time between failures), **MTTR** (mean time to repair), availability, and preventive-maintenance compliance, per equipment and per team.

### Does it work on mobile with QR codes?
Yes. FixFlow ships an installable PWA, QR-code scanning to jump to an asset, and on-site intervention signature capture.

### What tech stack does FixFlow use?
Next.js 15 (App Router) and React 19 on the front/API, Prisma ORM with PostgreSQL 15 for data, NextAuth for authentication, and Docker Compose for the dev environment.

---

## License

FixFlow is **dual-licensed**.

- **Open source — GNU AGPL-3.0** (see [LICENSE](LICENSE)). You may use, study, modify and self-host FixFlow freely. Because the AGPL includes a *network* clause, if you run a modified version as a service accessed over a network, you must make your modified source available to its users under the same license.
- **Commercial license** — for organizations that want to use FixFlow **without** the AGPL's copyleft/network obligations (for example to offer it as a closed-source hosted service or embed it in a proprietary product), a commercial license is available. Contact `<commercial-contact-email>`.

Copyright © 2026 `<copyright-holder>`. "FixFlow" and the project are dual-licensed (AGPL-3.0 OR commercial).

> **Contributions:** external contributions may require signing a Contributor License Agreement (CLA) so the project can continue to offer the commercial license. Open an issue before large contributions.
