# Platform launch: three parts

Written 2026-10-09. Each part below is a self-contained prompt for one implementation session. Run them **in order**, one at a time, and review and commit between parts.

| Order | Part                                        | Why this order                                                                                                                                     |
| ----- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Platform admin (owner oversight)            | The founder's top priority. Independent of the other parts. Security-sensitive, so it is built first while the surface is small.                   |
| 2     | Business page and "Салоноо бүртгүүлэх" flow | Sign-up and onboarding already work. This adds the page that explains the product and routes owners into them. A draft already exists (see below). |
| 3     | Public home with the salon directory        | Most useful once several salons exist. It depends on the salon data and listing rules defined in parts 1 and 2.                                    |

**Part 1 is done (2026-10-09).** See "Platform console" in `docs/DEVELOPMENT_ROADMAP.md`.

**Parts 2 and 3 are done (2026-10-09).**

- `/business` is live.
- Signed-out `/` rewrites to it.
- Contacts in `lib/site.ts` stay hidden until the owner provides real values.

---

## Shared context (include with every part)

You are continuing **Salon77**, a multi-tenant SaaS for Mongolian beauty salons. The stack is Next.js 16 App Router (read `node_modules/next/dist/docs/` before using unfamiliar APIs; middleware is `proxy.ts`), React 19, Prisma 6 on Supabase PostgreSQL, Supabase Auth (server-side only), Zod 4, Bun, `node --test`, and Playwright.

Read these first: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ENGINEERING_RULES.md`, `docs/DEVELOPMENT_ROADMAP.md`.

Non-negotiable:

- **UI text:**
  - All user-facing text is natural Mongolian Cyrillic. `tests/e2e/language.spec.ts` rejects Latin words, so write brand names in Cyrillic (Инстаграм) and use "мессеж", not "SMS".
- **Data access and permissions:**
  - Authorization is enforced server-side.
  - Never trust client-supplied IDs, roles or prices.
  - New tables get `ENABLE ROW LEVEL SECURITY` and `REVOKE ALL … FROM anon, authenticated`.
- **Migrations:**
  - Additive only.
  - Use the next free number in `prisma/migrations/` and check for numbers another session already took.
  - Never reset or run destructive SQL against Supabase. The owner applies migrations with `bun run db:migrate`.
- **Untouched code:** do not touch booking concurrency, idempotency or availability logic unless the part says so.
- **Verification before reporting:**
  - Run `bun run lint`, `bun run typecheck`, `bun run test`, `bun run test:integration`, `bun run test:e2e:integration`, the preview suite (`PLAYWRIGHT_PORT=32177 bun run test:e2e` against a build with Supabase/DB env vars blanked), and `bun run build`.
  - Report the real counts.
  - Look at desktop and mobile screenshots before calling UI work done.
- **Scope:**
  - Use the existing design tokens in `app/globals.css`: warm neutrals, `--accent` purple, soft borders.
  - Do not build features outside the part.

---

## Part 1: Platform admin (founder oversight)

**Goal.** The Salon77 owner (the platform operator, not a salon owner) can sign in and see every registered salon and how it uses the product.

**Access model:**

- Use the existing `User.isSuperAdmin` flag, which is reserved and currently grants nothing.
- Grant it only by direct SQL or a one-off script that the owner runs. There is no UI path to become a super admin, and the flag is never client-settable.
- Add a server helper `requirePlatformAdmin()` in `lib/auth.ts`. It verifies the session, loads the `User` row, and returns 404 (not 403, to avoid revealing the area) unless `isSuperAdmin` is true.
- Platform pages never use the salon tenant cookie or salon membership. They are a separate surface.

**Routes.** `app/platform/...` is a static segment, so it takes precedence over `(admin)/[module]`. It has its own minimal layout and does not reuse the salon `AdminShell`.

**Overview page `/platform`:**

- **Totals:**
  - Salons: all, active, suspended.
  - New salons in the last 7 and 30 days.
  - Branches, services and staff across all salons.
  - Online bookings: today, last 7 days, last 30 days.
  - All bookings in the last 30 days.
- **Small chart:** new salons per week and online bookings per day for the last 30 days. Reuse `components/revenue-chart.tsx` patterns. A single series needs no legend.
- **Salon table:**
  - Columns: name, slug (links to `/{slug}/book`), owner name and email, created date, status, branch count, active service count, staff count, online bookings in the last 30 days, total bookings, last booking date, last owner login (`User.lastLoginAt`).
  - Search by name or slug; sort by created date, bookings or last activity.
  - Paginate at 50 rows.

**Salon detail page `/platform/salons/[id]`:**

- The same metrics for one salon.
- Its branches (name, district, hours), service count by category, and members with role and last login.
- Booking counts by source (`ONLINE`/`RECEPTION`/`OWNER`) and by status over 30 days.
- No customer personal data (names, phones) on platform pages. Aggregates only.

**Actions:**

- Suspend and reactivate a salon (`Salon.status`), with a confirmation dialog.
- Suspension must block that salon's admin access and its public booking page. This already happens via `status: "ACTIVE"` checks; verify it.
- Record who suspended the salon and when in a new `PlatformAuditLog` table (actor user ID, action, salon ID, timestamp).

**Queries:**

- Use `groupBy`/`count`, never loading rows per salon in a loop.
- Keep `/platform` under about 10 queries.
- Index any new columns used for filtering.

**Tests:**

- **Integration:**
  - A normal salon owner gets 404 on every platform loader and action.
  - A super admin sees all salons with correct counts.
  - Suspend blocks admin and public booking; reactivate restores both.
  - Audit rows are written.
  - No customer phone numbers appear in platform responses.
- **Browser:** a seeded super-admin user can open `/platform` on desktop and mobile without horizontal overflow.

**Not in scope:** billing and subscriptions, impersonating salons, editing salon data, emails to salons.

**Deliverable note.** Explain exactly how the owner marks their own account as super admin (one SQL statement using their user ID or email). Do not run it against production.

---

## Part 2: Business page and registration path

**Goal.** A salon owner who clicks **"Салоноо бүртгүүлэх"** lands on a page explaining what Salon77 includes. They register with **"Бизнесээ бүртгүүлэх"** and go straight into their salon admin.

**Page `/business`** (finish the parked draft `docs/prompts/drafts/business-page.tsx.txt`; its CSS was never written):

- Header: logo, section links, and one "Нэвтрэх / Бүртгүүлэх" button (signed-in users see "Миний салон").
- Hero: what Salon77 is, primary call to action, and a coded (not image) mock of the calendar and of the phone booking page.
- **What's included**, grouped:
  - Online booking system: own link per salon (`salon77.mn/{slug}/book`), no customer sign-up, parallel two-service visits, deposits, discounts.
  - Admin control: calendar, bookings, customers, services, staff, timesheet, reports, settings.
  - Team and permissions: owner, manager, receptionist, staff roles, plus branch access.
  - Notifications and booking protection.
- An example of the booking link (show `salon77.mn/таны-салон/book` style text; the slug in Latin is allowed as a machine address).
- Three steps (register → set up → share link), a FAQ, and "Бидний тухай" with contacts from `lib/site.ts`.
- Pricing: say only that registration is free and plans will be announced. **Do not invent prices.**
- Every claim must match an implemented feature.

**Flow:**

- "Бизнесээ бүртгүүлэх" goes to `/sign-up`; onboarding follows automatically.
- After email confirmation the user goes to `/onboarding` and then to the salon dashboard.
- Already-signed-in users who click it go straight to the dashboard (or to onboarding if they have no salon).
- Verify the existing `safeAuthNext` allow-list accepts this; extend it narrowly if needed.

**Routing until part 3 ships:** signed-out `/` rewrites to `/business` in `proxy.ts` (`NextResponse.rewrite`, copying any refreshed auth cookies onto the rewrite response). Signed-in `/` stays the dashboard. Preview mode (no env) is unchanged.

**Contacts.** Fill `lib/site.ts` (`instagram`, `phone`) only with values the owner provides. Do not invent them.

**Tests:**

- **Preview e2e:** `/business` is Mongolian-only, has no overflow on desktop or mobile, and its links point to `/sign-up` and `/sign-in`.
- **Integration browser:** signed-out `/` shows the business page; signed-in `/` shows the dashboard.

**Not in scope:** the public salon directory (part 3), billing.

---

## Part 3: Public home with the salon directory

**Goal.** A customer visiting `salon77.mn` sees registered salons and can book online. The header carries **"Салоноо бүртгүүлэх"** (→ `/business`).

**Listing rules** (server-side, explicit `select` only):

- A salon appears only if it is `ACTIVE`, has public booking enabled, has at least one active online-bookable service, and has not opted out.
- Add `BookingSettings.listedInDirectory` (default `true`) with a toggle in Settings: "Salon77 нүүр хуудсанд харагдах".
- Never expose members, staff phones, customers or settings beyond what `/{slug}/book` already shows.

**Page `/`** (signed-out visitors; replace the part 2 rewrite to `/business` with a rewrite to the home page, for example `/home`):

- Header: logo, "Салоноо бүртгүүлэх", "Нэвтрэх".
- Hero with search by salon or service name, plus a district filter (from `Branch.district`).
- Salon cards: cover image (or initials), name, district or address, number of services, starting price, and a discount badge if any service is discounted. Each card links to `/{slug}/book`.
- Sort newest-first by default; text search is case-insensitive. Paginate at 24.
- A truthful empty state when no salons are listed.
- Mobile-first, reusing the visual language of `components/public-booking.tsx`.

**Search API.** `GET /api/public/salons?query=&district=&page=` uses explicit selects, the existing `guardPublic` rate limit and `Cache-Control: no-store`. Avoid N+1: aggregate service counts and minimum price with `groupBy`.

**Tests:**

- **Integration:** listing rules (suspended, disabled, opted-out or no-service salons are hidden), search and district filters, no private fields in the payload.
- **Browser:** signed-out `/` shows cards, a card opens that salon's booking page, the header button opens `/business`, Mongolian-only, no overflow.

**Not in scope:** maps and geolocation, ratings and reviews, customer accounts (later marketplace phases).
