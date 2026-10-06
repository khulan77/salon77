# Salon77 — Phase 2

A multi-tenant salon workspace built with Next.js 16 App Router, strict TypeScript, Tailwind 4, a shadcn-style Radix/CVA button foundation, Lucide, Prisma 6, PostgreSQL, Supabase Auth, and Zod. Uses self-hosted Inter with Cyrillic glyphs. The existing Next.js version was retained. Prisma 6 is deliberately pinned to its stable datasource/client API.

## Run locally

```sh
bun install
cp .env.example .env
# Fill the four variables below using your Supabase project.
bun run db:generate
bun run db:migrate
bun run dev
```

Use Node.js 22 or later for production (the local environment has Node.js 20, which currently builds but triggers a Supabase deprecation warning). Open http://localhost:3000. Without the runtime Supabase/database variables, the application presents a clearly labeled, read-only workspace preview. Preview mode contains no seeded salon, fake member, fabricated revenue, or local-storage business records. Mutation APIs fail with 503. Authentication is disabled until configured.

| Variable                               | Purpose                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Hosted Supabase project URL                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (`sb_publishable_…`); never use a secret/service-role key here |
| `DATABASE_URL`                         | Server-only PostgreSQL transaction pooler URL, with `pgbouncer=true`                    |
| `DIRECT_URL`                           | Direct PostgreSQL or session pooler connection used for migrations                      |

Use the connection strings shown by Supabase, with URL-encoded passwords. No service-role key is needed. The Prisma connection is a trusted server connection; it must have access to the private tables. Never expose either database URL to the browser.

In Supabase Auth, enable email/password authentication and email confirmation. Set the Site URL and allow `http://localhost:3000/auth/callback` locally, plus your exact Vercel deployment callback URL. Sign-up uses PKCE email confirmation and `/auth/callback` exchanges the code for a session; confirmation links should be opened in the same browser that initiated sign-up. Configure production SMTP in Supabase before launch. Logout clears the Supabase session and selected-tenant cookie.

## Implemented

- Neutral responsive admin shell, mobile navigation, page search, profile menu, loading/error states, and meaningful empty states.
- Four zero-state dashboard metrics, appointment empty state, real setup checklist, and explicitly future insights.
- Supabase sign-up, sign-in, sign-out, verified server identity, and session refresh through Next.js `proxy.ts`.
- Five-step onboarding: business information, unique URL, first branch, skippable branding, completion.
- Atomic user synchronization, salon creation, first branch creation, and owner membership in a serializable transaction.
- Branch list, create, edit, deactivate/reactivate, address, district, phone, optional coordinates; deactivation asks for confirmation and preserves records.
- Team list, member role/branch/active-state management, secure seven-day invitations, cancellation/reissue and verified-email acceptance. All owner-role edits are blocked by this editor to preserve final-owner access.
- Service categories and reusable salon-wide services, integer MNT prices, minute durations, multiple branches, online-bookable preference and deactivate/reactivate.
- Staff profiles independent of login accounts, optional member linkage, multiple branches and eligible services.
- Weekly branch-specific shifts, multiple recurring breaks, full-day/partial time off, manager branch permissions and staff self-access.
- Setup checklist driven by persisted services, staff eligibility and working hours; hidden when complete.
- All requested future navigation items lead to honest future-phase pages.

## Architecture

```text
app/
  (admin)/                protected server layout and dashboard
    [module]/             branches, team, services, staff, schedules and future modules
  api/                    authenticated, validated mutation boundaries
  auth/                   Supabase server actions and callback
  sign-in/, sign-up/      account entry
  onboarding/             salon creation wizard
components/               feature UI and reusable design primitives
lib/
  auth.ts                 verified identity and membership resolution
  access.ts               shared role/branch authorization and membership rechecks
  services/               transactional team, catalog and staff/schedule operations
  permissions.ts          Phase 1 owner policy
  admin-data.ts           request-local, tenant-scoped server reads
  validation.ts           shared Zod request schemas
  http.ts                 origin checks and safe error responses
  db.ts, supabase.ts       server clients
prisma/                   schema and deployable SQL migration
 tests/                   permission, validation, PostgreSQL, browser tests
```

Models: `User`, `Salon`, `SalonMember`, `Branch`, `MemberBranch`, `Invitation`, `InvitationBranch`, `ServiceCategory`, `Service`, `ServiceBranch`, `Staff`, `StaffBranch`, `StaffService`, `WorkingHours`, `WorkingBreak`, and `TimeOff`. `User.id` is the Supabase Auth UUID. A user can hold multiple salon memberships; Phase 1 exposes initial onboarding and one selected workspace, not a workspace switcher. `isSuperAdmin` is reserved, defaults false, and grants no implicit access or client-settable privileges. Salon roles are owner, manager, receptionist, and staff. Salon status can suspend access.

Booking, customer, inventory, billing, promotion and package models remain deferred. Phase 2 does not implement booking/calendar availability. Branch coordinates and unique salon slugs preserve the location and public-profile foundation. Every future business table must carry `salonId`; branch relationships should use composite foreign keys. Future appointments should prevent overlaps with a PostgreSQL exclusion constraint, rather than relying only on availability checks in application code.

## Security model

1. Supabase `auth.getUser()` verifies the session on the server. Cookie contents alone are not trusted.
2. The server resolves an active membership using the authenticated user ID. The selected-salon cookie is only a selector, never authority.
3. The salon and membership must be active. Owners manage all salon resources. Managers read assigned operational resources and edit schedules only within assigned branches. Receptionists read permitted branch resources without private time-off reasons or staff phone numbers. Staff see only their own active linked profile/schedule and eligible services, limited to the intersection of member permissions and staff branch assignments. A staff login without a linked profile has no operational branch access. Global catalog, staff and team edits remain owner-only.
4. Branch reads and updates include the resolved membership's `salonId`. Creation always injects the server-resolved salon ID. Zod rejects client-injected IDs/roles. Business profiles are deactivated rather than deleted. Schedule and time-off corrections can be deleted with confirmation.
5. All new category, branch, staff, service, schedule, break, invitation and optional member relationships carry composite tenant foreign keys. Cross-tenant relations fail in PostgreSQL even if application validation regresses.
6. The migration enables RLS with no browser policies and revokes table privileges from Supabase `anon` and `authenticated`. Business data is accessible only through the server's authorized Prisma layer, not directly through Supabase's browser Data API. Prisma uses a trusted role and does not rely on RLS for per-user authorization.
7. Same-origin checks protect mutation routes. Next server actions provide their own origin checks. Unique slugs, coordinate checks, owner-invitation prohibition, and membership uniqueness are database constraints.

Invitations use a random 256-bit token; only its SHA-256 hash is persisted. A verified matching email, unexpired pending invitation, active salon and valid active branches are required. A serializable transaction claims the token once and creates membership/branch permissions. Acceptance selects the destination tenant using an HTTP-only cookie. Only exact invitation paths can survive sign-in/sign-up/email confirmation; arbitrary redirects are rejected. Pending invitation reissue invalidates older links. Expiry is enforced on reads/acceptance without requiring a scheduler.

Email delivery is not integrated. Development mode shows a one-time owner-only link explicitly labeled as test behavior. Production fails closed unless `ALLOW_DEVELOPMENT_INVITE_LINKS=true` is explicitly enabled for a controlled staging environment. The link is never included in the general team data response. Existing Phase 1 drafts remain non-accepting `DRAFT` records and must be reissued.

### Scheduling representation

- `WorkingHours.dayOfWeek`: 1 = Monday through 7 = Sunday, using Asia/Ulaanbaatar local time.
- `startMinute`/`endMinute`: integer local minutes, half-open `[start, end)`, with 1440 permitted as the end of day. Overnight shifts must be split across two days. Unconfigured days are unavailable; inactive periods represent non-working time.
- A PostgreSQL `btree_gist` exclusion constraint blocks overlapping active periods for one staff member across **all** branches on the same weekday. Adjacent periods are permitted.
- Breaks are children of a specific shift, can be multiple, cannot overlap and must remain inside an active parent shift. Saving a shift replaces its breaks atomically. Database triggers also check containment when a break or shift changes.
- Time off stores UTC instants with exclusive end boundaries. Full-day UI end dates are inclusive and become next-midnight UTC boundaries at +08:00. Time off is explicitly branch-specific; add it at each affected branch for a multi-branch absence. Reasons are returned only to owners, authorized managers and the linked employee.
- Removing a staff branch with existing hours/time off is rejected until its schedules are corrected. Deactivation retains historical records and removes access/eligibility. Staff-service assignments require a shared service branch; removing the final shared service branch is rejected.

### Migrations

Apply the migrations in order using `bun run db:migrate`: `202610050001_foundation`, `202610050002_team`, `202610050003_services`, `202610050004_staff_schedules`. The last migration enables `btree_gist`; the migration role must be able to create this extension. All new business tables enable RLS and revoke Supabase browser-role privileges. Use the trusted server database connection, never browser Data API calls, for private operational data.

## Routes

- `/` — dashboard
- `/branches` — branch management
- `/team` — member permissions and invitations
- `/invite?token=…` — authenticated invitation confirmation
- `/services`, `/employees`, `/schedules` — operational management
- `/sign-up`, `/sign-in`, `/auth/callback` — authentication
- `/onboarding` — salon creation
- `/api/branches` — GET, POST, PATCH (query `id` is always tenant-scoped)
- `/api/onboarding` — GET availability, POST atomic creation
- `/api/invitations` — POST create/reissue, PATCH cancel; `/api/invitations/accept` — GET inspect, POST accept
- `/api/members` — PATCH owner-controlled role/branch/active-state updates
- `/api/categories`, `/api/services`, `/api/staff` — GET scoped lists, POST create, PATCH update
- `/api/working-hours`, `/api/time-off` — GET scoped schedule, POST/PATCH save, DELETE correction
- Operational GET endpoints accept optional `branchId`, which is checked against server-resolved access.
- Future pages: `/calendar`, `/bookings`, `/customers`, `/reviews`, `/packages`, `/promotions`, `/inventory`, `/sales`, `/salon-page`, `/gallery`, `/reports`, `/plan`, `/partnership`, `/support`, `/settings`.

Public `/{salon-slug}` rendering is not enabled yet. The onboarding validator reserves application paths, and PostgreSQL guarantees uniqueness. Future public rendering must select only publishable fields, never reuse the private admin data loader.

## Verification

```sh
bun run lint
bun run typecheck
bun run test
bun run test:integration
bun run build
PLAYWRIGHT_PORT=32177 bun run test:e2e
bun run test:e2e:integration
```

Install Chromium once with `bunx playwright install chromium`. The preview suite uses the production build without runtime credentials. The integration browser suite starts a separate `.next-integration` development server (32178), an ephemeral PGlite PostgreSQL-protocol server (55479), and a local Supabase-compatible auth fixture (55480). Service integration tests use port 55478. These test fixtures never contact the hosted project and do not add any production authentication bypass. Do not run two integration suites on the same ports concurrently.

Unit tests cover validation, authentication continuation, Mongolian labels/dates and Phase 1 database constraints. Phase 2 integration tests apply every migration and execute **real Prisma queries** against embedded PostgreSQL, deliberately attempting cross-tenant categories, services, staff, assignments, shifts, breaks, time off and team edits. They also test branch revocation, staff self-scope, private reasons, invitation replay, verified matching email, expiry, cancellation and browser-role database denial. PGlite uses a single PostgreSQL session: this verifies SQL constraints and transactional code, not hosted multi-connection load or concurrency behavior.

Browser integration tests create a category, service and multi-branch assignment, staff profile/service eligibility, shifts, multiple breaks and full-day time off; then create an invitation, sign in as the invited receptionist, accept it and verify actual HTTP branch restrictions. Additional HTTP tests cover cross-tenant IDs, owner protection, origin checks, manager access and staff without a linked profile. Desktop and mobile Chromium are included. Screenshots and failure traces are under ignored `test-results/`.

### Verification status

Local verification on 2026-10-05:

- ESLint: passed with no warnings.
- Strict TypeScript: passed.
- Unit/localization/foundation PostgreSQL tests: **29 passed**.
- Phase 2 Prisma/PostgreSQL security integration tests: **16 passed** (15 cases plus the parent test).
- Production-preview desktop/mobile browser tests: **20 passed**.
- Authenticated desktop/mobile browser integration tests: **6 passed**.
- Production webpack build: passed.
- Phase 2 desktop/mobile screenshots visually reviewed; no horizontal overflow in tested viewports.

Full hosted signup/email-confirmation/persistence acceptance and deployment are **not verified**. The developer reports that all four migrations have already been deployed successfully; the environment fix does not rerun or reset them. The live Auth configuration and configured signup/login forms were checked separately below. Before deployment, complete real signup/confirmation/sign-in/invitation acceptance in staging, including multi-connection race behavior.

## Deployment and limits

Use Node.js 22+ and configure the four connection variables above. `bun run build` uses the supported webpack backend; installation generates Prisma Client. Apply migrations as a controlled deployment step before serving the new application. Do not apply initialization migrations over unrelated tables.

Invitation email provider integration, automated delivery, rate limiting/audit trails, workspace switching, account recovery UI and image uploads remain deferred. Optional `imageUrl` fields exist for services and staff; no storage/upload pipeline is claimed. Branding can be skipped. Production invitation creation requires the explicit staging-only link flag until delivery is implemented.

All application UI, navigation, validation and user-facing messages use Mongolian Cyrillic. Identifiers, routes and developer documentation remain English. Brand names, email addresses, URL slugs and UTC notation are intentionally preserved. No booking engine, marketplace, billing or fabricated analytics is included.

Phase 3 can use existing branches, service prices/durations, staff-service and staff-branch eligibility, structured weekly hours, recurring breaks and date-specific time off to calculate availability. Booking persistence, calendar rendering and booking conflict prevention are deliberately not implemented in Phase 2.

## Supabase Auth environment troubleshooting

The application uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` consistently. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name is not read. Auth runs through server actions and the SSR server client; there is no separate browser Supabase client. Both `lib/supabase.ts` and `proxy.ts` use the same validated `authEnv()` configuration. The client form receives only a configuration boolean, not database credentials.

`configured` requires a valid HTTP(S) Supabase URL, an `sb_publishable_` key and a valid server-only PostgreSQL `DATABASE_URL`. Missing/malformed configuration keeps the auth form disabled. Validation errors never include environment values. `DIRECT_URL` remains required for Prisma migrations.

After editing `.env`, stop and restart `bun dev`, then reload `/sign-up`. Next.js loads environment files from the project root; process environment and `.env.local` can override `.env`. Public variables are fixed into production bundles at build time, so rebuild after changing them. Keep `.env.example` placeholder-only and never paste standalone connection-string lines without a variable name.

### Publishable-key fix verification

- Lint, strict TypeScript and production build passed with the configured local environment.
- 33 unit/foundation/configuration tests passed, including four new environment regression tests.
- Two desktop/mobile form smoke tests passed against a development server using the real local environment: no unconfigured warning, editable valid form fields, signup/login buttons enabled. No valid signup was submitted by these tests.
- The real Supabase Auth settings endpoint returned 200: email signup enabled, signup not disabled, email confirmation required. An intentionally malformed-email signup request returned 400 (`validation_failed`) without creating an account.
- Completing a real account and email-confirmation flow still requires the developer's chosen test email. Open the confirmation link in the browser that initiated signup so the PKCE verifier remains available.
- `.env` is ignored, is absent from the Git index/reachable history, and its database credentials were not found in generated browser assets. The example file is placeholder-only. A public publishable key exists in prior Git history; no secret/service-role key or real database password was found in the inspected index/history. Rotate the database password shared in the conversation, then update the two local database URLs privately.

To rerun the non-submitting form check, start a configured development server and run `SALON77_AUTH_TEST_URL=http://localhost:3000 bunx playwright test --config playwright.auth.config.ts` (use the actual server origin). For the manual acceptance test, ensure that origin's `/auth/callback` URL is allowed in Supabase Auth URL Configuration, restart `bun dev`, open `/sign-up`, register with an inbox you control, confirm the email in the same browser, and complete salon onboarding. Keep credentials out of logs and Git.
