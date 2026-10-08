# Salon77 — Architecture

_Last verified against the repository: 2026-10-08 (commit `333f202`)._ The README has more operational detail (environment setup and the verification history).

## Stack

| Layer      | Choice                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Framework  | Next.js **16.3.8** App Router (route handlers, server components). Build uses `next build --webpack`   |
| UI         | React 19.2, Tailwind CSS 4, a CVA/Radix `Button` primitive, Lucide icons, self-hosted Inter (Cyrillic) |
| Validation | Zod 4 (strict schemas at every API boundary)                                                           |
| Database   | PostgreSQL on Supabase, Prisma **6** (pinned), raw SQL inside migrations for constraints               |
| Auth       | Supabase Auth through `@supabase/ssr`, server-side only (no browser Supabase client)                   |
| Tooling    | Bun 1.3 (package manager), Node ≥ 22 runtime, `node --test` + `tsx`, Playwright, ESLint, Prettier      |
| Tests DB   | PGlite (embedded PostgreSQL) served over a socket for integration tests                                |
| Hosting    | Intended: Vercel (app) + Supabase (DB/Auth). No deployment config is committed.                        |

Next.js 16 differs from earlier versions. Request interception lives in `proxy.ts`, not `middleware.ts`. Read `node_modules/next/dist/docs/` before using unfamiliar APIs (see `AGENTS.md`).

## Folder structure

```text
app/
  (admin)/layout.tsx         protected shell; loads adminData()
  (admin)/page.tsx           dashboard
  (admin)/[module]/page.tsx  one dynamic route renders every admin module; moduleAllowed() gates by role
  [module]/book/page.tsx     public booking page (/{salon-slug}/book)
  api/...                    route handlers: authenticated, validated, same-origin mutation boundaries
  api/public/[slug]/...      unauthenticated availability + booking
  auth/                      server actions (sign-in/up/out) and PKCE callback
  onboarding/, invite/, sign-in/, sign-up/
components/                  client feature components (calendar, wizard, settings, directories…)
lib/
  env.ts                     validated runtime configuration (`configured` flag)
  auth.ts                    identity() → membership() → tenant()
  access.ts                  Actor model, branch checks, refreshActor(), moduleAllowed()
  permissions.ts             Phase 1 owner/branch permission predicate
  http.ts                    sameOrigin() and failure(): safe Mongolian error responses
  business-time.ts           Asia/Ulaanbaatar conversions (timezone-parameterised)
  booking-validation.ts      booking/availability Zod schemas, status transitions, labels
  booking-settings.ts        policy schema + defaults
  services/                  domain logic: bookings, booking-settings, customers, catalog, staff, team
  admin-data.ts              request-cached tenant-scoped reads for the shell
prisma/schema.prisma, prisma/migrations/   6 migrations (see below)
tests/                       unit, integration (PGlite), browser (Playwright), live (opt-in, real DB)
proxy.ts                     refreshes the Supabase session cookie on every request
```

## Authentication

- `lib/supabase.ts` creates a server client from cookies. `identity()` calls `auth.getUser()`, which verifies the session with Supabase. Cookie contents are never trusted alone.
- Sign-up uses PKCE email confirmation. `/auth/callback` exchanges the code for a session.
- Only the public URL and the **publishable** key are used. No service-role key exists in the code.
- If configuration is missing or malformed, `configured` is `false`. The app then shows a read-only preview and mutation APIs return 503.

## Authorization and multi-tenancy

- Tenant scope comes **only** from an active `SalonMember` row for the authenticated user. The `salon77-tenant` cookie only selects among the user's own memberships. It never grants access.
- `actorFromMember()` builds an `Actor` (`salonId`, `role`, `branchIds`, `staffId`). For STAFF, branch access is the intersection of the member's branches and the linked staff profile's branches.
- Domain services call `refreshActor()` inside the transaction, so a revoked membership or branch takes effect immediately.
- Every query includes `salonId: actor.salonId`. Non-owners are further restricted to `branchId in actor.branchIds`.
- Roles:
  - `SALON_OWNER`: everything.
  - `MANAGER`: assigned branches, including schedule edits.
  - `RECEPTIONIST`: assigned branches; bookings and customers; no private time-off reasons or staff phones.
  - `STAFF`: own profile and schedule only; no booking management.
  - Settings, catalog, staff and team edits, and customer edits are owner-only.
- **Database-level isolation:** every business table carries `salonId`, and child relations use composite foreign keys `(id, salonId)`. A cross-tenant link therefore fails in PostgreSQL even if application code regresses.
- **Browser roles:** RLS is enabled with no policies, and all privileges are revoked from Supabase `anon`/`authenticated`. All data access goes through Prisma on the trusted server connection.
- Mutation routes call `sameOrigin()`, which provides CSRF protection.

## Data model

Foundation: `User` (id = Supabase Auth UUID), `Salon` (unique `slug`, `status`), `SalonMember`, `Branch`, `MemberBranch`, `Invitation`, `InvitationBranch`.
Catalog/staff: `ServiceCategory`, `Service` (`priceMnt` integer, `durationMinutes`), `ServiceBranch`, `Staff` (optional `memberId`), `StaffBranch`, `StaffService`, `WorkingHours` (local minutes, 1 = Mon … 7 = Sun), `WorkingBreak`, `TimeOff` (UTC instants).
Bookings: `Customer` (unique `(salonId, phone)`, phone normalized to `+976…`), `Booking` (snapshots of service name, duration, price and customer name/phone; `status`, `source`, `idempotencyKey`, `requestHash`, `version`).
Settings: `BookingSettings`, one row per salon. A DB trigger creates it on salon insert, and the migration backfills existing salons.

Migrations (applied in order with `prisma migrate deploy`):

| Migration                       | Content                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `202610050001_foundation`       | users, salons, members, branches, invitations, RLS/revokes        |
| `202610050002_team`             | invitation tokens/status, member-branch                           |
| `202610050003_services`         | categories, services, service-branch                              |
| `202610050004_staff_schedules`  | staff, shifts, breaks, time off, `btree_gist` exclusion, triggers |
| `202610060005_bookings`         | customers, bookings, overlap exclusion constraint, value checks   |
| `202610070006_booking_settings` | `BookingSettings`, bounds check, backfill, insert trigger         |

## Booking architecture

All booking paths (owner, manager/receptionist and public guest) go through `lib/services/bookings.ts`.

**Context.** `resolveContext()` returns either an authenticated actor scope (booking roles only) or a public scope. A public scope requires a valid slug for an `ACTIVE` salon and allows only `onlineBookable` services. Both scopes load the salon's `BookingSettings` policy.

**Availability (`slots()`)**

1. Reject public requests when `publicBookingEnabled` is off.
2. Enforce the horizon: `advanceBookingDays` for public requests and 365 days for admins.
3. Resolve the service: it must be active, have an active category, be offered at the branch and, for public requests, be online-bookable. Resolve eligible staff: active, assigned to the branch, assigned to the service, sorted by ID.
4. Load that day's active shifts and breaks, branch time off, and non-cancelled bookings for those staff.
5. Walk a grid of `slotIntervalMinutes` from local midnight. A start is valid when the **whole** `[start, start + duration)` interval fits inside a shift and overlaps no break, time off or booking. It must also be in the future and, for public requests, after `now + minimumBookingNoticeMinutes`.
6. Return start times. The server keeps the list of eligible staff IDs per start time.

Intervals are half-open, so back-to-back appointments are allowed. Every status except `CANCELLED` occupies its time.

**Creation (`createBooking()`)** runs in a SERIALIZABLE transaction with up to 3 retries:

1. Validate with Zod. Reject the request if the actor lacks access to the branch.
2. **Idempotency.** Hash the normalized input together with the principal (member ID, or `"public"`). If `(salonId, idempotencyKey)` already exists, return the existing booking when the hash matches, or respond 409 when it differs.
3. Take `pg_advisory_xact_lock` on every candidate staff member, in sorted order.
4. Recompute availability inside the transaction. The requested start must still be a valid slot. Otherwise respond 409.
5. Pick a customer. Public bookings upsert the customer by phone and never overwrite an existing record. Admins either pick a scoped existing customer or create one.
6. Insert the booking. Price, duration and name are taken from the database service, never from the client. "Any staff" resolves to the first eligible staff member by ID. Public bookings start as `PENDING` under `MANUAL_CONFIRM` and `CONFIRMED` under `AUTO_CONFIRM`. Admin bookings start as `CONFIRMED`.

**Concurrency layers:**

1. The PostgreSQL exclusion constraint `Booking_no_overlap` on `(staffId, tstzrange(startAt, endAt))` where status ≠ `CANCELLED`. It applies across branches and also covers writes that bypass the service.
2. Advisory locks per staff member.
3. SERIALIZABLE isolation with retry. A retry that still conflicts becomes HTTP 409.

**Lifecycle (`changeBooking()`).** Optimistic `version` check. Status transitions:

- `PENDING → CONFIRMED | CANCELLED`
- `CONFIRMED → COMPLETED | CANCELLED | NO_SHOW`
- `COMPLETED`, `CANCELLED` and `NO_SHOW` are terminal.

Rescheduling (`PENDING`/`CONFIRMED` only) locks the old and new staff members, recomputes availability excluding the booking itself, and moves the booking atomically while keeping its snapshots.

**Calendar** (`components/booking-calendar.tsx` and `GET /api/bookings`): day or week (1–7 days), branch and staff filters, at most 1,000 rows per query.

**Customers** (`lib/services/customers.ts`): 30 per page, searchable by name or phone. Non-owners see only customers who have bookings in their branches, and only that part of each customer's history. Notes are owner-only.

**Public booking** (`/{slug}/book` and `api/public/[slug]/*`): `publicCatalog()` returns only publishable fields (branch name and address, service name, price and duration, staff name and title) plus the booking policy. The receipt omits customer data and IDs.

## Reports

`lib/services/reports.ts` provides `revenueReport(db, actor, {from, to, branchId?})`. Access is owner/manager only, with manager queries scoped to their branches. It loads the `COMPLETED` bookings whose `startAt` falls in the local date range, and `aggregateRevenue()` (a pure, unit-tested function) buckets them by day or month and ranks services and staff. `/reports` renders it server-side from URL search parameters. The dashboard shows month-to-date figures. The chart (`components/revenue-chart.tsx`) is dependency-free HTML/CSS and has a single accent series with per-bar hover/focus tooltips.

## Time handling

Instants are stored as `timestamptz(3)`. `lib/business-time.ts` converts local dates and minutes to instants for a timezone parameter that defaults to `Asia/Ulaanbaatar` (UTC+8, no DST). Shifts use local minutes, and time off uses UTC instants. The timezone is not configurable per salon yet.

## External integrations

Only **Supabase Auth** is integrated. There is no email, SMS, payments, maps, file storage or analytics. Invitation links are shown in the UI in development, or in production when `ALLOW_DEVELOPMENT_INVITE_LINKS=true`.

## Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (must start with `sb_publishable_`), `DATABASE_URL` (pooler, `pgbouncer=true`, server-only), `DIRECT_URL` (migrations) and `ALLOW_DEVELOPMENT_INVITE_LINKS`. `.env` is git-ignored. `.env.example` holds placeholders only.
