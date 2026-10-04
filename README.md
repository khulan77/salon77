# Salon77 — Phase 1

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

| Variable                        | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Hosted Supabase project URL                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key; never use a service-role key here     |
| `DATABASE_URL`                  | Server-only PostgreSQL transaction pooler URL, with `pgbouncer=true` |
| `DIRECT_URL`                    | Direct PostgreSQL or session pooler connection used for migrations   |

Use the connection strings shown by Supabase, with URL-encoded passwords. No service-role key is needed. The Prisma connection is a trusted server connection; it must have access to the private tables. Never expose either database URL to the browser.

In Supabase Auth, enable email/password authentication and email confirmation. Set the Site URL and allow `http://localhost:3000/auth/callback` locally, plus your exact Vercel deployment callback URL. Sign-up uses PKCE email confirmation and `/auth/callback` exchanges the code for a session; confirmation links should be opened in the same browser that initiated sign-up. Configure production SMTP in Supabase before launch. Logout clears the Supabase session and selected-tenant cookie.

## Implemented

- Neutral responsive admin shell, mobile navigation, page search, profile menu, loading/error states, and meaningful empty states.
- Four zero-state dashboard metrics, appointment empty state, real setup checklist, and explicitly future insights.
- Supabase sign-up, sign-in, sign-out, verified server identity, and session refresh through Next.js `proxy.ts`.
- Five-step onboarding: business information, unique URL, first branch, skippable branding, completion.
- Atomic user synchronization, salon creation, first branch creation, and owner membership in a serializable transaction.
- Branch list, create, edit, deactivate/reactivate, address, district, phone, optional coordinates; deactivation asks for confirmation and preserves records.
- Team listing and invitation **drafts**, with roles and one or more active branch assignments. Saving a draft does not send email or grant access.
- All requested future navigation items lead to honest future-phase pages.

## Architecture

```text
app/
  (admin)/                protected server layout and dashboard
    [module]/             branches, team, and future-module pages
  api/                    authenticated, validated mutation boundaries
  auth/                   Supabase server actions and callback
  sign-in/, sign-up/      account entry
  onboarding/             salon creation wizard
components/               feature UI and reusable design primitives
lib/
  auth.ts                 verified identity and membership resolution
  permissions.ts          deny-by-default role policy
  admin-data.ts           request-local, tenant-scoped server reads
  validation.ts           shared Zod request schemas
  http.ts                 origin checks and safe error responses
  db.ts, supabase.ts       server clients
prisma/                   schema and deployable SQL migration
 tests/                   permission, validation, PostgreSQL, browser tests
```

Models: `User`, `Salon`, `SalonMember`, `Branch`, `MemberBranch`, `Invitation`, and `InvitationBranch`. `User.id` is the Supabase Auth UUID. A user can hold multiple salon memberships; Phase 1 exposes initial onboarding and one selected workspace, not a workspace switcher. `isSuperAdmin` is reserved, defaults false, and grants no implicit access or client-settable privileges. Salon roles are owner, manager, receptionist, and staff. Salon status can suspend access.

Future booking, staff, working hours, services, customers, inventory, plans, subscriptions, payments, promotions, packages, and support models are intentionally deferred to avoid speculative schema. Branch coordinates and unique salon slugs preserve the location and public-profile foundation. Every future business table must carry `salonId`; branch relationships should use composite foreign keys. Future appointments should prevent overlaps with a PostgreSQL exclusion constraint, rather than relying only on availability checks in application code.

## Security model

1. Supabase `auth.getUser()` verifies the session on the server. Cookie contents alone are not trusted.
2. The server resolves an active membership using the authenticated user ID. The selected-salon cookie is only a selector, never authority.
3. The salon must be active. Owner-only pages and mutations require `SALON_OWNER`. Manager/receptionist/staff admin access is denied until scoped modules are implemented. There is no role-changing or membership-joining API.
4. Branch reads and updates include the resolved membership's `salonId`. Creation always injects the server-resolved salon ID. Zod rejects client-injected IDs/roles. There is no hard-delete API in this phase.
5. Branch assignments use `(id, salonId)` foreign keys for both membership and invitation records. Cross-tenant relations fail in PostgreSQL even if application validation regresses.
6. The migration enables RLS with no browser policies and revokes table privileges from Supabase `anon` and `authenticated`. Business data is accessible only through the server's authorized Prisma layer, not directly through Supabase's browser Data API. Prisma uses a trusted role and does not rely on RLS for per-user authorization.
7. Same-origin checks protect mutation routes. Next server actions provide their own origin checks. Unique slugs, coordinate checks, owner-invitation prohibition, and membership uniqueness are database constraints.

Invitation drafts persist a random 256-bit token's SHA-256 hash and a seven-day expiry. The raw token is discarded because there is no delivery/acceptance endpoint. Before enabling invitations, regenerate a fresh token, deliver it through a configured provider, and implement atomic single-use acceptance restricted to the verified matching email, unexpired/unrevoked state, and still-valid tenant/branch assignments. Add revoke/resend, rate limits, and audit records at that point. Do not turn the current draft IDs into public acceptance URLs.

## Routes

- `/` — dashboard
- `/branches` — branch management
- `/team` — members and invitation drafts
- `/sign-up`, `/sign-in`, `/auth/callback` — authentication
- `/onboarding` — salon creation
- `/api/branches` — GET, POST, PATCH (query `id` is always tenant-scoped)
- `/api/onboarding` — GET availability, POST atomic creation
- `/api/invitations` — POST draft
- Future pages: `/calendar`, `/bookings`, `/customers`, `/reviews`, `/services`, `/packages`, `/promotions`, `/inventory`, `/sales`, `/employees`, `/schedules`, `/salon-page`, `/gallery`, `/reports`, `/plan`, `/partnership`, `/support`, `/settings`.

Public `/{salon-slug}` rendering is not enabled yet. The onboarding validator reserves application paths, and PostgreSQL guarantees uniqueness. Future public rendering must select only publishable fields, never reuse the private admin data loader.

## Verification

```sh
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:e2e
```

Unit/validation tests exercise owner isolation, inactive and missing memberships, branch-limited role policies, tenant ID injection, role escalation, malformed fields, reserved slugs, and coordinates. Embedded PostgreSQL tests apply the actual migration and verify unique slugs, composite foreign keys, tenant-scoped mutations, blocked public API roles, and transaction rollback. They use PGlite, not a live Supabase database.

Playwright checks the production preview at desktop and iPhone sizes: layout overflow, empty states, branch form, navigation search, onboarding steps, invitation-draft messaging, and fail-closed mutation endpoints. Install its browser once with `bunx playwright install chromium`. Screenshots are written under ignored `test-results/`. Run preview browser tests without Supabase environment variables; they intentionally assert preview behavior. The browser server can be reused if already running on port 3000.

**Live deployment acceptance still required:** real Supabase sign-up/email confirmation/sign-in/sign-out, schema deployment, salon onboarding/persistence, branch edits across sessions, and two authenticated owners attempting each other's record IDs and selected-salon cookies. No live Supabase credentials were supplied, so those flows must not be treated as verified by the local test suite.

## Verified results

Local verification on 2026-10-05:

- ESLint: passed, no warnings.
- Strict TypeScript: passed.
- Unit/validation/embedded PostgreSQL: 20 tests passed.
- Production preview browser suite: 10 tests passed across desktop and mobile Chromium.
- Production build: passed with Next.js webpack backend.
- Desktop/mobile screenshots visually inspected; no horizontal overflow in tested viewports.
- Live hosted Supabase auth and persistence: not run; credentials were not provided.

## Deployment and limits

Deploy to Vercel with the four environment variables. Build command: `bun run build` (uses the supported webpack backend because this environment blocks Turbopack’s internal worker port); installation generates Prisma Client. Apply `bun run db:migrate` using the direct connection as a controlled deployment step before opening the app to users. The migration is new-schema initialization; do not apply it over unrelated existing tables.

Brand image uploads, Supabase Storage buckets/policies, workspace switching, role-specific screens, invitation delivery/acceptance, account recovery UI, and audit trails are not implemented. Branding can be skipped. All application UI, navigation, validation, and user-facing messages use Mongolian Cyrillic by default. Code identifiers, routes, and developer documentation remain English. Brand names, email addresses, URL slugs, and UTC notation are intentionally preserved. No booking engine, marketplace, billing, or fabricated analytics is included.

Phase 2 should complete invitation acceptance and branch-scoped roles, then implement services, staff assignments/working hours, and the booking engine with database-enforced overlap protection. Build customer records and public booking pages on that foundation. Payments, POS, inventory, and marketplace discovery should remain separately scoped.
