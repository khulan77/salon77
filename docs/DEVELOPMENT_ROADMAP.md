# Salon77 — Development Roadmap & Status

_Audit date: 2026-10-08, commit `333f202` ("salon77 phase4.1")._

Status vocabulary:

- **IMPLEMENTED**: the code exists in the repository.
- **TESTED**: verified by tests executed on the audit date.
- **REPORTED**: claimed by earlier handoffs or the README, not re-verified on the audit date.
- **PLANNED**: not built yet.

## Verification run on 2026-10-08

| Check                                         | Result                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `bun run lint`                                | passed                                                                                             |
| `bun run typecheck`                           | passed                                                                                             |
| `bun run test` (unit/localization/foundation) | **39/39 passed**                                                                                   |
| `bun run test:integration` (PGlite)           | **37/37 passed** (Phase 2, Phase 3, Phase 4.1 suites)                                              |
| `bun run build`                               | passed                                                                                             |
| `bun run test:e2e` (preview, unconfigured)    | **20/20 passed** (needs a build _without_ runtime env vars; with `.env` loaded, 18 fail by design) |
| `bun run test:e2e:integration`                | **10/10 passed** (desktop + mobile)                                                                |
| Live Supabase concurrency test                | **not run** (it writes to the real DB, so it is opt-in only)                                       |
| `prisma migrate status` (live DB, read-only)  | 5 of 6 applied. **`202610070006_booking_settings` is NOT applied**                                 |

Local Node is v20. Production requires Node ≥ 22.

## Phase status

| Phase                              | Scope                                                                                            | Status                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1 Foundation                       | Auth, onboarding, tenants, branches, admin shell, Mongolian UI                                   | IMPLEMENTED + TESTED                                                                                               |
| 2 Team/Services/Staff              | Invitations, roles, catalog, staff, schedules, time off                                          | IMPLEMENTED + TESTED; applied to live DB                                                                           |
| 3 Booking core                     | Customers, bookings, availability, concurrency, idempotency, calendar, lifecycle, public booking | IMPLEMENTED + TESTED (embedded DB + browser); live concurrency REPORTED (2026-10-06); migration applied to live DB |
| 4.1 Booking settings               | Policy table, owner settings UI, enforcement in availability/creation                            | IMPLEMENTED + TESTED locally. **Migration not applied to live DB**. Not documented in README                       |
| 4.2 Notification foundation        | Outbox, templates, provider interface, delivery and retry, owner log                             | IMPLEMENTED + TESTED (2026-10-09). Migration `202610090015_notifications`. No real SMS gateway yet                 |
| 4.3 Reminder engine                | Configurable lead times, cancellation-aware, send-time status check                              | IMPLEMENTED + TESTED (2026-10-09). Migration `202610090018_reminders`                                              |
| 4.4 Public booking protection      | Rate limits, per-phone quota, honeypot, pending auto-expiry                                      | IMPLEMENTED + TESTED (2026-10-09). Migration `202610090014_booking_protection`                                     |
| 4.5 Cancellation/reschedule policy | Guest manage link, notice deadline, salon override via calendar                                  | IMPLEMENTED + TESTED (2026-10-09). Migration `202610090019_manage_links`                                           |
| 4.6 Admin notifications/ops        | Activity bell: new online, customer cancel/move, expired, pending count                          | IMPLEMENTED + TESTED (2026-10-09). Migration `202610090020_booking_activity`                                       |
| 4.7 Operational UX polish          | Reception flow, mobile, states                                                                   | PLANNED                                                                                                            |
| 5–10                               | Packages/promotions, inventory/POS, payments, subscriptions, marketplace, super admin            | PLANNED                                                                                                            |

### Phase 4.1 details

- **Done:**
  - `BookingSettings` model and migration: bounds CHECK, backfill of existing salons, and an `AFTER INSERT` trigger on `Salon` that creates default settings.
  - Owner-only `GET/PATCH /api/booking-settings`.
  - Settings screen at `/settings`.
  - Enforcement in `lib/services/bookings.ts`:
    - `publicBookingEnabled` blocks public catalog, availability and creation. Admin booking keeps working.
    - `bookingConfirmationMode` sets public bookings to PENDING or CONFIRMED.
    - `advanceBookingDays` applies to public bookings; admins always get 365 days.
    - `minimumBookingNoticeMinutes` applies to public bookings.
    - `slotIntervalMinutes` (15/30) applies to all bookings.
  - Integration tests cover defaults, tenant isolation, owner-only access, and each rule.
- **Stored but not enforced:** `cancellationNoticeMinutes`. The UI says so honestly. This value belongs to Phase 4.5.
- **Leftovers:**
  - `SLOT_INTERVAL_MINUTES` in `lib/business-time.ts` is now unused.
  - The README has no Phase 4.1 section.
- **Remaining before it can be called done in production:**
  1. Apply the migration with `bun run db:migrate`.
  2. Run the manual check on a real account: toggle each setting and observe the public page.

## Added after the audit (2026-10-08)

- **Migration 0006 applied to live Supabase** by the owner. `prisma migrate status` reports the schema is up to date, and the backfill and trigger are present.
- **Sidebar cleanup:** the sidebar lists only working modules (`navigation`). Unbuilt pages live in `hiddenModules` and stay routable. `/bookings` remains as an alias of the calendar.
- **Revenue report** (`/reports` plus a dashboard summary): owners see the whole salon, managers see their assigned branches only, and reception/staff get 403. Revenue is the sum of the price snapshots of `COMPLETED` bookings, bucketed by Ulaanbaatar day (monthly beyond 62 days, maximum 366 days). It also shows breakdowns by service and by staff, plus no-show and cancelled counts. It is **not a payment ledger**, and extra charges are not modelled. Tests: `tests/reports.test.ts`, `tests/integration/reports.test.ts`, `tests/browser-integration/reports.spec.ts`.
- **Known flaky test (pre-existing):** when run alone, `tests/integration/booking-settings.test.ts` intermittently fails its last subtest. The PGlite socket fixture drops Prisma's connection after a constraint error. It passes in the full `bun run test:integration` run. Fix this in the fixture, not in the app.
- Marking a future booking `COMPLETED` is still allowed. This now inflates the report, so it should be fixed soon.

- **Service catalog redesign and discounts** (pulled forward from Phase 5 at the owner's request):
  - The list is now a vertical row list with an inline editor.
  - `Service.discountPercent` (0–90) is added by migration `202610080007_service_discount`. The discounted price, rounded to the nearest 100₮ by `lib/pricing.ts`, is written to `Booking.priceSnapshot` together with `discountPercentSnapshot`. Existing bookings are never repriced. The public catalog returns `priceMnt` (the sale price) and `listPriceMnt`.
  - **This migration must be applied to live Supabase (`bun run db:migrate`) before this code runs against it.**
  - Out of scope: service images (no storage pipeline yet), time-limited promotions, and package deals.

- **Settings redesign, deposits and salon cover** (owner request; deposits pulled forward from Phase 7 as manual bank transfer):
  - Migration `202610090008_booking_deposit` adds `BookingSettings.deposit*` and `Booking.depositAmountSnapshot`.
  - Online bookings that need a deposit always start `PENDING`, and staff confirm them after checking the transfer. Reception bookings never require a deposit.
  - The public receipt shows the bank, account, holder and payment reference (the guest's phone).
  - Cover images upload through `POST/DELETE /api/salon-cover` to the Supabase Storage bucket `salon-media`, using the server-only `SUPABASE_SECRET_KEY`. The type is checked from the file bytes and the size is capped at 4MB.
  - **Setup needed:** create a _public_ bucket named `salon-media` in Supabase Storage, put the secret key in `.env`, then run `bun run db:migrate`.
  - The calendar does not show the deposit amount yet (`BookingView.depositMnt` is available). QPay remains Phase 7.

- **Phase 4.4 public booking protection** (2026-10-09):
  - Postgres fixed-window rate limits keyed by a hashed client fingerprint (`lib/rate-limit.ts`): 120 availability requests per 10 min, 8 bookings per 10 min per salon, 30 per day.
  - At most 4 upcoming active online bookings per phone per salon (`lib/services/guest-guard.ts`).
  - A honeypot `website` field on the public form.
  - Optional `pendingExpiryMinutes`. Expiry is applied lazily on availability, booking and calendar reads, so no scheduler is needed.
  - No CAPTCHA provider yet. `RATE_LIMIT_SALT` may be set in production.
- **Test fixture stabilised:** `close()` waits before closing PGlite, and the Phase 4.1 role test resets the shared session first. The integration suite now passes reliably.

- **Phase 4.2 notification foundation** (2026-10-09):
  - `Notification` is an outbox row written in the same transaction as the booking change (`lib/notifications/outbox.ts`). Events: received, confirmed, cancelled, rescheduled. The `dedupeKey` (event + booking or group + version) makes idempotent replays and retries safe.
  - Delivery runs in `after()` once the response is sent (`lib/notifications/schedule.ts`). It claims rows with `FOR UPDATE SKIP LOCKED`, retries with exponential backoff up to 5 attempts, and reclaims rows stuck in `SENDING`.
  - `GET /api/cron/notifications` (Bearer `CRON_SECRET`) lets an external scheduler drain retries. Vercel Hobby only runs cron daily, so no `vercel.json` is committed.
  - Providers live in `lib/notifications/provider.ts`. Only `log` (development) exists; with no provider, notices are marked `SKIPPED`. A real gateway is a one-function addition once chosen.
  - Owners turn delivery on per salon in Settings and see the last 30 notices with masked phone numbers.
  - Expired-pending cancellations do not notify yet.
- Raw SQL timestamp parameters are converted to UTC explicitly (rate limits, notification claims), so the database session time zone can never shift comparisons.

- **Platform console** (2026-10-09, part 1 of `docs/prompts/platform-launch.md`):
  - `/platform` and `/platform/salons/[id]` are reachable only by users with `User.isSuperAdmin = true`; everyone else gets a 404.
  - It shows salon totals and growth, online and all bookings, per-salon branch, service, staff and booking counts, owner and member last login, and suspend/reactivate with `PlatformAuditLog`.
  - Aggregates only; no customer names or phones.
  - Grant access with SQL in Supabase (`UPDATE "User" SET "isSuperAdmin" = true WHERE email = '<owner email>';`). There is no UI path.
  - Migration `202610090016_platform_audit`.

- **Business page** (2026-10-09, part 2 of `docs/prompts/platform-launch.md`):
  - `/business` explains the product to salon owners.
  - Signed-out visitors to `/` are rewritten to it in `proxy.ts`. Signed-in users keep the dashboard, and preview mode is unchanged.
  - The call to action sends visitors to `/sign-up`, owners to `/`, and users without a salon to `/onboarding`.
  - Contacts live in `lib/site.ts` and are hidden while empty. No pricing is stated beyond "registration is free".

- **Public home with the salon directory** (2026-10-09, part 3 of `docs/prompts/platform-launch.md`):
  - Signed-out `/` is rewritten (with its query string) to `/home`, which lists salons with search by salon or service name and a district filter.
  - Cards link to `/{slug}/book`. The header links to `/business`.
  - Listing rules live in `lib/services/directory.ts`: an active salon, public booking on, `BookingSettings.listedInDirectory` (Settings toggle, default on), and at least one bookable online service.
  - Explicit public fields only.
  - `GET /api/public/salons` is rate-limited.
  - Migration `202610090017_directory`.

- **Phase 4.3 reminders:**
  - `BookingSettings.reminderMinutes` (2 days, 1 day, 3 h, 2 h or 1 h before; default 1 day).
  - Reminder rows are outbox notices scheduled via `availableAt`, keyed by start instant: confirming keeps them, rescheduling replaces them, cancelling withdraws them.
  - At send time the dispatcher skips anything not `CONFIRMED` and upcoming, and anything from a salon that turned notifications off.
  - Delivery runs on booking activity and on calendar polling. **Reliable overnight delivery needs an external scheduler** calling `GET /api/cron/notifications` every 5–10 min with `Authorization: Bearer $CRON_SECRET`.
- **Phase 4.5 guest self-service:**
  - Every online visit gets a 32-byte manage token (SHA-256 stored in `Booking.manageTokenHash`, shared by the visit).
  - `/{slug}/manage?token=` lets the guest cancel or move the whole visit (same staff, own durations) until `cancellationNoticeMinutes` before the start. After that it shows the salon phone.
  - Replays cannot reveal the token again. Messages include an absolute link only when `APP_URL` is set.
  - Salon staff can still change anything from the calendar.
- **Phase 4.6 admin activity:**
  - `BookingActivity` is written in the same transaction for online creation, customer cancel/reschedule and auto-expiry.
  - The top-bar bell (owner, manager, reception, branch-scoped) shows unread counts per member (`SalonMember.activitySeenAt`), the pending-confirmation count and the latest 30 events, polling every 60 s.
- **Salon applications** (2026-10-10):
  - Onboarding now asks for an Instagram or Facebook page (one is required), the service types (`lib/salon-application.ts`) and the staff count, and creates the salon with `Salon.reviewStatus = PENDING`.
  - While `PENDING` or `REJECTED` the owner can use the whole admin (a banner explains the state), but `resolveContext` and `listDirectory` hide the salon from every public path: booking page, manage links, public APIs and the home directory.
  - The operator sees the queue on `/platform` and approves or sends back with a reason from the salon page (`reviewSalon`, audited as `APPROVE_SALON` / `REJECT_SALON`). An approval can be withdrawn the same way.
  - The owner reads the reason on `/onboarding/review`, corrects the details and resubmits (`PATCH /api/onboarding`), which returns the salon to the queue.
  - `reviewStatus` defaults to `APPROVED` in the database so salons created before this change stay public; onboarding is the only code that creates a salon and it always writes `PENDING`.
  - The operator is not notified by message; new requests appear on `/platform`.
  - Migration `202610100022_salon_review`.

## Recommended sequencing and dependencies

1. **Close out 4.1 on live:** apply migration 0006, then run the manual acceptance check. Code at `main` calls `bookingSettings` on every booking path. Against the current live DB this fails, and booking returns 500 errors.
2. **Pull 4.4 (public booking protection) ahead of 4.2/4.3, or run it alongside them.** Public, unauthenticated writes are open today. One script could fill every slot with PENDING bookings or create many customer rows. This risk grows the moment the public link is shared. Pending bookings never expire.
3. **4.2 → 4.3 → 4.6.** Reminders and admin alerts both need the event/outbox foundation. A real SMS/email provider choice is a business decision, so do not invent one. Reminders also need a scheduler (for example Vercel Cron or Supabase pg_cron). That choice should be made in 4.2.
4. **4.5** needs a way for customers to identify themselves without accounts, such as a signed manage-link token. It pairs naturally with 4.2, which delivers the link.
5. Phases 7 and 8 (payments, subscriptions) should come before the marketplace (9) if revenue is the near-term goal. An entitlement check layer (plan → features) is cheap to add early. No pricing should be hardcoded.

## Known gaps carried forward

- No email delivery: invitations rely on a development link, and Supabase Auth emails need production SMTP.
- No rate limiting, CAPTCHA or audit trail.
- No per-salon timezone; Asia/Ulaanbaatar is hardcoded as the default.
- No workspace switcher; a user with several memberships uses the cookie selector or the oldest membership.
- No image upload pipeline: `imageUrl`/`logoUrl` fields exist but are unused.
- No deployment configuration (Vercel project, Node 22 pinning) is committed.
- The real-account manual acceptance flow (public booking → calendar → double-booking rejection → reschedule → completion → customer history) has **no recorded evidence** of being completed by a person. Automated browser tests cover it against local fixtures only.
