# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FixFlow is an internal maintenance ticket management platform. Users declare incidents on equipment, tickets are auto-assigned to the owning team, and include a chat system with attachments, manual exports/statistics, and backoffice for managing locations and equipment. The stack uses Next.js (front + API), PostgreSQL + Prisma, and Docker for environments.

## Common Commands

### Database Setup
```bash
# Start PostgreSQL and Adminer
docker compose up -d db adminer

# Generate Prisma client
docker compose exec app npm run prisma:generate

# Create/apply migrations
docker compose exec app npm run prisma:migrate

# Seed the database with sample data
docker compose exec app npm run prisma:seed
```

### Development
The Next.js application is not yet implemented. When it is:
- Database runs on `localhost:5432` (or `db:5432` inside Docker)
- Adminer web UI available at `http://localhost:8080`
- Use `.env` file for configuration (copy from `.env.example`)

## Architecture

### Data Model Core Concepts

The Prisma schema ([app/prisma/schema.prisma](app/prisma/schema.prisma)) implements these key relationships:

1. **Ticket-centric model**: Tickets are the central entity, linked to:
   - Equipment (which has a Location, Team, and Category)
   - User (requester via LDAP)
   - TicketStatus (customizable per team, admin-only edits)
   - Optional Maintainer (external technician/contractor)
   - ChatMessages and Attachments (photos/PDFs)
   - TicketReport (auto-generated from incident form)
   - TicketSubscriptions (control visibility)

2. **Team ownership**: Equipment belongs to a Team, which automatically assigns tickets and owns custom TicketStatus entries.

3. **User roles** (via LDAP):
   - `ADMIN`: Manages statuses, groups, exports, all backoffice
   - `MANAGER`: Configures teams, locations, equipment, group subscriptions
   - `MAINTAINER`: Handles assigned tickets, adds chat/attachments
   - `BASIC`: Declares incidents, sees only their subscribed equipment/tickets

4. **Visibility control**: Groups and GroupMembers manage bulk subscriptions. TicketSubscriptions control per-ticket access.

5. **Lifecycle tracking**: Tickets have `openedAt`, optional `closedAt`, `invoiceNumber`, `quoteNumber` for administrative follow-up.

### Key Models

- **User**: LDAP-based auth, role determines permissions
- **Team**: Owns equipment and custom statuses
- **Location**: Physical sites where equipment resides
- **Equipment**: Has refCode (unique), belongs to Location + Team + Category
- **Ticket**: Central entity with status, urgency, optional maintainer, chat, attachments, report
- **TicketStatus**: Customizable per team, only admins can modify
- **ChatMessage**: Threaded discussion on tickets
- **Attachment**: Photos/PDFs linked to tickets or chat messages
- **TicketReport**: Auto-generated from incident declaration form
- **Maintainer**: Optional external technician reference
- **Group/GroupMember**: Bulk user subscription management

### Enums

- `UserRole`: ADMIN, MANAGER, MAINTAINER, BASIC
- `TicketUrgency`: LOW, MEDIUM, HIGH, CRITICAL
- `AttachmentType`: PHOTO, PDF, OTHER

## Important Documentation

- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md): Auth & roles guide — LDAP/Microsoft SSO, bootstrap, user management, troubleshooting
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md): Prisma model explanation with JSON prototype and setup instructions
- [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md): Database schema reference
- [docs/LOCATIONS.md](docs/LOCATIONS.md): **Site (Location) model and seed format — demo sites only**
- [docs/PWA_TECHNICIEN_SECURITY.md](docs/PWA_TECHNICIEN_SECURITY.md): External maintainer PWA security model

## Next.js Integration (To Be Implemented)

When building the Next.js application:

1. **Authentication**: LDAP integration required for all roles. Sync groups and roles automatically.

2. **Permissions model**:
   - Status editing: ADMIN only
   - Backoffice (locations/equipment/groups): ADMIN and MANAGER
   - Ticket assignment/chat: MAINTAINER (for assigned tickets)
   - Incident declaration: All authenticated roles with proper subscriptions
   - Exports: ADMIN and MANAGER

3. **Key workflows**:
   - Incident declaration → auto-generate TicketReport → create Ticket → auto-assign to Equipment's Team
   - Ticket updates → chat with attachments → status changes (admin-controlled) → optional maintainer/invoice/quote tracking
   - Visibility → filter by user's GroupMembers and TicketSubscriptions

4. **UI stack**: Tailwind CSS (no component libraries specified)

5. **API approach**: Use Next.js Server Actions and/or route handlers for data mutations and queries

## Locations (Sites)

Sites are defined in [app/prisma/locations-data.ts](app/prisma/locations-data.ts) and documented in [docs/LOCATIONS.md](docs/LOCATIONS.md). The seed ships **fictitious demo sites only** — replace them with your own from the backoffice (or edit that file) for a real deployment.

**Location model fields:**
- `code`: Unique site code (NOR, SUD, EST, etc.)
- `name`: Full site name (e.g., "Site Nord")
- `address`: Street address
- `city`: City name
- `postalCode`: Postal code
- `email`: Site contact email

**Management:**
- Demo sites are created during seed
- ADMIN/MANAGER can add new sites via backoffice
- Sites are used to organize equipment and tickets by location

## Seed Data

The [app/prisma/seed.ts](app/prisma/seed.ts) script creates:
- **Demo sites** (from locations-data.ts)
- A sample team, equipment category, and equipment
- Default ticket statuses
- Sample users (technician, manager), ticket, maintainer, group, and chat messages

Run `docker compose exec app npm run prisma:seed` after database setup to populate initial data.

## Database Connection

- Development: `postgresql://maintenance:maintenance@localhost:5432/maintenance`
- Docker internal: `postgresql://maintenance:maintenance@db:5432/maintenance`
- Configure via `DATABASE_URL` in `.env` file
