# Salon77 — Production deployment

Hosting: **Vercel** (Next.js) + **Supabase** (PostgreSQL, Auth, Storage). Code: `github.com/khulan77/salon77`, branch `main`.
Do the steps in order; each ends with a check. Never paste secret values into chat, tickets or Git.

## 0. Before you start

- `main` is committed and pushed; local tests pass.
- `bunx prisma migrate status` against the production database says **"Database schema is up to date"**. If not, run `bun run db:migrate` first. **Migrations must be applied before deploying code that needs them.**

## 1. Supabase project settings

1. **Auth → URL Configuration**
   - Site URL: `https://<your-domain>` (e.g. `https://salon77.mn`)
   - Redirect URLs: add `https://<your-domain>/auth/callback` (keep `http://localhost:3000/auth/callback` for development).
2. **Auth → Providers → Email**: email/password on, "Confirm email" on.
3. **Auth → SMTP Settings**: configure a real sender (Supabase's built-in sender is rate-limited to a few emails per hour and is not for production). Any SMTP provider works (e.g. a Gmail Workspace account, Mailgun, Resend, Brevo). Sender name: `Salon77`.
4. **Storage**: a **public** bucket named `salon-media` must exist (cover, gallery, service and staff photos). Created on the current project on 2026-10-11.
5. **Project Settings → API Keys**: note the **publishable** key (`sb_publishable_…`) and the **secret** key (`sb_secret_…`). The secret key is only ever stored as a server environment variable.
6. **Project Settings → Database → Connection string**: note the **Transaction pooler** URL (port 6543) and the **Session/direct** URL (port 5432).

Check: you can sign up locally and receive the confirmation email from your SMTP sender.

## 2. Vercel project

1. vercel.com → **Add New → Project** → import `khulan77/salon77`.
2. Framework: Next.js (auto). Build command: leave default (`bun run build` from `package.json`). Install command: `bun install`.
3. **Settings → General → Node.js Version: 22.x** (the app requires Node ≥ 22).
4. **Settings → Environment Variables** (Production; copy to Preview only if you use a separate database):

| Variable                               | Value                                                                                           | Secret?    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<project-ref>.supabase.co`                                                             | public     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`                                                                              | public     |
| `DATABASE_URL`                         | pooler URL, port 6543, ending `?pgbouncer=true`                                                 | **secret** |
| `DIRECT_URL`                           | direct/session URL, port 5432                                                                   | **secret** |
| `SUPABASE_SECRET_KEY`                  | `sb_secret_…` (photo and logo uploads, invited receptionist accounts; **not** the legacy JWT)   | **secret** |
| `APP_URL`                              | `https://<your-domain>` (manage links in messages, sitemap)                                     | public     |
| `CRON_SECRET`                          | 32+ random characters (`openssl rand -hex 32`)                                                  | **secret** |
| `RATE_LIMIT_SALT`                      | 32+ random characters                                                                           | **secret** |
| `SMS_PROVIDER`                         | empty (record only), `log` (dev), or `http` (real gateway)                                      | —          |
| `SMS_HTTP_URL`                         | gateway endpoint, only with `SMS_PROVIDER=http`                                                 | —          |
| `SMS_HTTP_API_KEY`                     | gateway key, sent as `Authorization: Bearer …`                                                  | **secret** |
| `SMS_SENDER`                           | sender name or number registered with the gateway                                               | —          |
| `DIRECTORY_MIN_SALONS`                 | optional; listed salons needed before `/` shows the directory (default 5)                       | —          |
| `RESEND_API_KEY`                       | optional; Resend key for platform and owner emails (see 2c)                                     | **secret** |
| `PLATFORM_ALERT_EMAIL`                 | `salon77.mn@gmail.com`; gets new-salon and new-feedback alerts                                  | —          |
| `RESEND_FROM`                          | sender on a domain verified in Resend, e.g. `Salon77 <hello@salon77.mn>`; never a Gmail address | —          |
| `RESEND_REPLY_TO`                      | optional; reply-to address, default `salon77.mn@gmail.com`                                      | —          |

Never set `RATE_LIMIT_*` overrides in production unless you mean to loosen protection.

5. **Deploy.** Check the build log ends with "Compiled successfully".

Check: `https://<deployment>.vercel.app/api/health` returns `{"status":"ok","storage":"ready"}`. `"storage":"unconfigured"` means photo uploads are off; see section 2a.

## 2a. Photos and logos (Supabase Storage)

Uploads go from the server to Supabase Storage; the stored public URL is shown everywhere. If photos work locally but not on Vercel, check in this order:

1. **Secret key format.** `SUPABASE_SECRET_KEY` must be the new `sb_secret_…` key (Supabase → Project Settings → API Keys → Secret keys). The legacy `service_role` key starts with `eyJ…` and is rejected. With a wrong key the upload answers «Зураг хадгалах үйлчилгээ серверт тохируулагдаагүй…», and the Vercel function log says `Salon77 image uploads disabled: <reason>`. Paste the value without quotes.
2. **Same project.** `NEXT_PUBLIC_SUPABASE_URL`, both keys and `DATABASE_URL` must all belong to one Supabase project. A key from another project makes Storage answer 401/403 (logged as `Salon77 image upload failed: Supabase Storage answered 403 …`).
3. **Set before the build.** `next.config.ts` reads `NEXT_PUBLIC_SUPABASE_URL` at **build** time to allow resizing of Storage photos (`images.remotePatterns`), and every `NEXT_PUBLIC_*` value is baked into the bundle. Add or change these variables for **Production** (and Preview if used), then **Redeploy** (Deployments → ⋯ → Redeploy, without the build cache). A build without it logs `NEXT_PUBLIC_SUPABASE_URL is missing at build time`.
4. **Bucket.** Storage → Buckets → `salon-media` exists and **Public bucket** is on. A private bucket stores files but browsers get 400 for their URLs.
5. **Stored URLs.** Photos uploaded while the local `.env` pointed at a different project keep that project's address in the database. Run the read-only check against production settings:

   ```bash
   vercel env pull .env.production.local
   node --env-file=.env.production.local --import tsx scripts/check-media.ts
   rm .env.production.local
   ```

   It prints ✓/✗ for the key format, the bucket, whether every stored URL uses this project's host, and whether one photo opens without login. It never prints keys. Photos stored under another host must be uploaded again from Settings.

## 2c. Platform email (Resend)

Emails the platform sends:

| When                            | To                                | Needs                                         |
| ------------------------------- | --------------------------------- | --------------------------------------------- |
| A salon signs up or resubmits   | `PLATFORM_ALERT_EMAIL`            | `RESEND_API_KEY`, `PLATFORM_ALERT_EMAIL`      |
| A salon sends feedback          | `PLATFORM_ALERT_EMAIL`            | `RESEND_API_KEY`, `PLATFORM_ALERT_EMAIL`      |
| The platform approves a salon   | the salon owner                   | the above plus a verified `RESEND_FROM`       |
| The platform sends a salon back | the salon owner (with the reason) | the above plus a verified `RESEND_FROM`       |
| An owner invites a receptionist | the invited person                | `RESEND_API_KEY` and a verified `RESEND_FROM` |

Rules:

- **Gmail (or any free mailbox) is never the sender.** Resend can only send from a domain you verify. A Gmail, Yahoo, Outlook, iCloud or similar address in `RESEND_FROM` is ignored.
- **Replies go to `salon77.mn@gmail.com`.** Every email carries `Reply-To: salon77.mn@gmail.com` (override with `RESEND_REPLY_TO`), so owners can answer even though the sender is a no-reply domain address.
- **Verify a domain:** Resend → Domains → add `salon77.mn` → add the DNS records it shows → wait for "Verified". Then set `RESEND_FROM=Salon77 <hello@salon77.mn>` and redeploy.

Without a verified domain (no `RESEND_FROM`, or a Gmail one):

- **Works:** alerts to you (new salon, new feedback), sent from Resend's shared `onboarding@resend.dev`. They only arrive if `PLATFORM_ALERT_EMAIL` is the same address as your Resend account login.
- **Does not work:** approval and send-back emails to owners, and receptionist invitation emails. Nothing is sent. Owners still see the decision and the reason on their application page, and owners copy the invitation link instead.

`/platform/settings` shows the same status live: sender, reply-to, alert address, and a tick or cross for each kind of email.

## 2b. Region and database connection (speed)

Every admin page runs several database queries one after another, so the distance between the Vercel function and the database is paid many times per click.

- **Supabase database region:** `ap-southeast-1` (Singapore) — the pooler host is `aws-0-ap-southeast-1.pooler.supabase.com`.
- **Vercel function region:** `sin1` (Singapore), pinned in `vercel.json`. Without it Vercel uses `iad1` (Washington, D.C.), about 220 ms away from Singapore per round trip. Check: Vercel → Project → Settings → Functions → Function Region shows Singapore, or a deployment's function log shows `sin1`. If the database ever moves, change `regions` in `vercel.json` to the matching Vercel region.
- **Connection:** `DATABASE_URL` is the transaction pooler (port 6543). The app connects through `@prisma/adapter-pg` (`lib/db.ts`), which sends each query in one round trip; Prisma's own `pgbouncer=true` mode took about five round trips per query (measured 556 ms vs 136 ms per query from Ulaanbaatar). `lib/db.ts` drops Prisma-only URL options (`pgbouncer`, `connection_limit`, `statement_cache_size`, `socket_timeout`), so the URL from the table above still works. Do **not** add `connection_limit=1`: pages run queries in parallel, and one connection serialises them. Prisma CLI (`db:migrate`) keeps using `DIRECT_URL`.
- **Auth:** `proxy.ts` and `membership()` verify the session JWT locally with `getClaims()` (the project uses asymmetric ES256 signing keys), so a page no longer waits on the Auth server. If the project is switched back to the legacy HS256 secret, `getClaims()` falls back to a network call and pages slow down again.

Check after a deploy: open «Тайлан», then «Календарь»; the skeleton appears at once and the page fills in well under a second.

## 2c. Photos and Vercel image optimization

Photos are served straight from Supabase Storage (`images.unoptimized` in `next.config.ts`). Vercel's image optimizer is off by default because on the Hobby plan it answers `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` once the monthly quota is used, and every photo then shows as broken. On a paid plan, set `IMAGE_OPTIMIZATION=on` and redeploy to turn it back on.

## 3. Domain

1. Vercel → **Settings → Domains** → add `salon77.mn` and `www.salon77.mn` (redirect www → apex).
2. At your domain registrar, create the DNS records Vercel shows (usually an `A` record to Vercel's IP for the apex and a `CNAME` for `www`). HTTPS certificates are issued automatically.
3. After the domain works, confirm `APP_URL` and the Supabase Site URL use it.

Check: `https://salon77.mn` shows the salon directory when signed out; `https://salon77.mn/business` shows the business page.

## 4. Scheduled delivery (reminders)

Vercel Hobby runs cron jobs only once a day, so use a free external scheduler (e.g. cron-job.org):

- URL: `https://<your-domain>/api/cron/notifications`
- Method: GET, every 5 minutes
- Header: `Authorization: Bearer <CRON_SECRET>`

The same call also marks confirmed bookings whose time has passed as completed (for salons that keep «Цаг нь өнгөрсөн захиалгыг автоматаар дууссанд тооцох» on), so revenue reports fill in even when nobody presses «Дууссан». Opening the calendar or the report does the same for that salon.

Check: the job history shows HTTP 200 with a JSON body like `{"claimed":0,"sent":0,"completed":0}`. A 401 means the header or secret is wrong.

Optional uptime monitor: same service, `GET https://<your-domain>/api/health` every 5 minutes, alert on non-200.

## 5. Platform admin

In Supabase → SQL Editor, once, with your own login email:

```sql
UPDATE "User" SET "isSuperAdmin" = true WHERE email = '<your email>';
```

Check: `https://<your-domain>/platform` opens for you and returns 404 for anyone else.

## 6. Smoke test on production

1. Signed out: `/` lists salons; `/business` → "Бизнесээ бүртгүүлэх" → sign-up → confirmation email arrives → onboarding (Instagram/Facebook, service types, staff count) → dashboard with the "Хүсэлт хянагдаж байна" banner.
   - `/platform` → «Шинэ хүсэлтүүд» → «Шалгах» → «Зөвшөөрөх». Until then the salon's booking page returns 404.
2. Add a service (online bookable), a staff member with working hours.
3. On a phone, open `/<slug>/book`, book a time; the receipt shows "Захиалгаа удирдах".
4. Admin: the bell shows the new booking; confirm it in the calendar.
5. Open the manage link, move the time, then cancel.
6. `/platform` shows the salon with its counts.
7. Settings: upload a cover image (verifies `SUPABASE_SECRET_KEY` and the bucket); add a photo to a service and a staff member and see them on `/<slug>/book`.
8. `/support`: send a request; it appears at `/platform/feedback`; answer it and see the answer on `/support`.

## Rollback

Vercel → **Deployments** → previous successful deployment → **Promote to Production**. Migrations are additive, so older code keeps working against a newer schema.

## Known production limits

- No SMS gateway yet: notifications are recorded and shown in Settings but not sent. Until `SMS_PROVIDER=http` and all three `SMS_*` values are set, the business page marks SMS features "Удахгүй" and Settings says messages are not sent. The `http` provider's request body is a placeholder: adapt it in `lib/notifications/provider.ts` to the chosen gateway before turning it on.
- Invitation emails are not integrated; use development links only in a controlled period.
- Payments (QPay) are not integrated; deposits are by bank transfer and checked manually.
