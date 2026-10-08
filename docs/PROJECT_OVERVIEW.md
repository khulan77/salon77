# Salon77 — Project Overview

_Last verified against the repository: 2026-10-08 (commit `333f202`)._

## What Salon77 is

Salon77 is a multi-tenant SaaS for appointment-based beauty businesses in Mongolia: hair, nail and lash studios, spas and similar salons. Each salon gets an isolated administration workspace for operations and bookings. Salons will pay a monthly subscription. Pricing has not been decided and is not encoded anywhere in the product.

Today, many Mongolian salons take bookings through Instagram/Facebook messages, phone calls, notebooks and spreadsheets. That leads to double bookings, missed appointments, scattered customer records and no reporting. Salon77 replaces this with one reliable, Mongolian-language system.

The initial market is Ulaanbaatar. The UI language is Mongolian Cyrillic, and the business timezone is `Asia/Ulaanbaatar`.

## Target users

| User                     | Need                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| Salon owner              | Full control of branches, team, services, staff, bookings, settings |
| Manager                  | Run the branches they are assigned to                               |
| Receptionist             | Fast day-to-day booking, calendar and customer work                 |
| Staff (service provider) | See their own schedule and eligible services                        |
| Guest customer           | Book online from a phone without creating an account                |
| Platform owner (future)  | Manage salons, subscriptions, billing and support                   |

A **SalonMember** (a login account with a role) and a **Staff** profile (a person who performs services) are separate entities. A receptionist may have no Staff profile. A Staff profile may have no login account.

## Product surfaces

1. **Salon administration** (`/`, `/calendar`, `/bookings`, `/customers`, `/services`, `/employees`, `/schedules`, `/team`, `/branches`, `/settings`): built and in use.
2. **Public booking page** (`/{salon-slug}/book`): built. It is a single-salon booking wizard, not yet a marketplace.
3. **Marketplace**: discovery, districts, maps, reviews. Planned (Phase 9).
4. **Platform super admin**: planned (Phase 10). `User.isSuperAdmin` exists but grants nothing.

## Current functionality (in code)

- Supabase email/password sign-up (with email confirmation), sign-in and sign-out. Sessions are refreshed through `proxy.ts`.
- Five-step salon onboarding: business information, unique slug, first branch, optional branding.
- Branches with district, address, phone and optional coordinates. Branches can be deactivated and reactivated.
- Team: invitations stored as hashed, seven-day, single-use tokens; roles; branch assignment; membership management. Email delivery is **not** integrated. A development-only invite link stands in for it.
- Service categories and services with integer MNT prices, durations in minutes, branch availability and an online-bookable flag.
- Staff profiles with branch and service eligibility; weekly shifts, multiple breaks, and full-day or partial time off.
- Booking core: availability engine, admin booking wizard, day/week calendar, booking lifecycle (confirm, cancel, complete, no-show, reschedule), customer directory with history, and public guest booking that offers an "any staff" option.
- Booking settings (Phase 4.1): public booking on/off, auto or manual confirmation, advance booking window, minimum notice, slot interval (15/30), and a stored cancellation-notice value. Cancellation notice is **not enforced yet**; enforcement is planned for Phase 4.5.
- Dashboard with today's booking counts and completed-service value. This value is not a payment ledger.
- Navigation entries for future modules (reviews, packages, promotions, inventory, sales, salon page, gallery, reports, plan, partnership) lead to honest "coming later" pages.

## Not implemented yet

Notifications (SMS or email), reminders, public abuse protection or rate limiting, customer self-service cancellation, packages and promotions, inventory and POS, payments and deposits, subscriptions and billing, marketplace, super admin, image uploads, a workspace switcher and per-salon timezones.

See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) for status and sequencing, [ARCHITECTURE.md](ARCHITECTURE.md) for how the system is built, and [ENGINEERING_RULES.md](ENGINEERING_RULES.md) for the rules every change must follow.
