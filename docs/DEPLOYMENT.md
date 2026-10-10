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
4. **Storage**: a **public** bucket named `salon-media` must exist (salon cover images).
5. **Project Settings → API Keys**: note the **publishable** key (`sb_publishable_…`) and the **secret** key (`sb_secret_…`). The secret key is only ever stored as a server environment variable.
6. **Project Settings → Database → Connection string**: note the **Transaction pooler** URL (port 6543) and the **Session/direct** URL (port 5432).

Check: you can sign up locally and receive the confirmation email from your SMTP sender.

## 2. Vercel project

1. vercel.com → **Add New → Project** → import `khulan77/salon77`.
2. Framework: Next.js (auto). Build command: leave default (`bun run build` from `package.json`). Install command: `bun install`.
3. **Settings → General → Node.js Version: 22.x** (the app requires Node ≥ 22).
4. **Settings → Environment Variables** (Production; copy to Preview only if you use a separate database):

| Variable                               | Value                                                       | Secret?    |
| -------------------------------------- | ----------------------------------------------------------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<project-ref>.supabase.co`                         | public     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`                                          | public     |
| `DATABASE_URL`                         | pooler URL, port 6543, ending `?pgbouncer=true`             | **secret** |
| `DIRECT_URL`                           | direct/session URL, port 5432                               | **secret** |
| `SUPABASE_SECRET_KEY`                  | `sb_secret_…` (cover image uploads)                         | **secret** |
| `APP_URL`                              | `https://<your-domain>` (manage links in messages, sitemap) | public     |
| `CRON_SECRET`                          | 32+ random characters (`openssl rand -hex 32`)              | **secret** |
| `RATE_LIMIT_SALT`                      | 32+ random characters                                       | **secret** |
| `SMS_PROVIDER`                         | leave empty until a gateway is integrated                   | —          |
| `ALLOW_DEVELOPMENT_INVITE_LINKS`       | `true` only while invitation emails are not integrated      | —          |

Never set `RATE_LIMIT_*` overrides in production unless you mean to loosen protection.

5. **Deploy.** Check the build log ends with "Compiled successfully".

Check: `https://<deployment>.vercel.app/api/health` returns `{"status":"ok"}`.

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

Check: the job history shows HTTP 200 with a JSON body like `{"claimed":0,"sent":0}`. A 401 means the header or secret is wrong.

Optional uptime monitor: same service, `GET https://<your-domain>/api/health` every 5 minutes, alert on non-200.

## 5. Platform admin

In Supabase → SQL Editor, once, with your own login email:

```sql
UPDATE "User" SET "isSuperAdmin" = true WHERE email = '<your email>';
```

Check: `https://<your-domain>/platform` opens for you and returns 404 for anyone else.

## 6. Smoke test on production

1. Signed out: `/` lists salons; `/business` → "Бизнесээ бүртгүүлэх" → sign-up → confirmation email arrives → onboarding → dashboard.
2. Add a service (online bookable), a staff member with working hours.
3. On a phone, open `/<slug>/book`, book a time; the receipt shows "Захиалгаа удирдах".
4. Admin: the bell shows the new booking; confirm it in the calendar.
5. Open the manage link, move the time, then cancel.
6. `/platform` shows the salon with its counts.
7. Settings: upload a cover image (verifies `SUPABASE_SECRET_KEY` and the bucket).

## Rollback

Vercel → **Deployments** → previous successful deployment → **Promote to Production**. Migrations are additive, so older code keeps working against a newer schema.

## Known production limits

- No SMS gateway yet: notifications are recorded and shown in Settings but not sent.
- Invitation emails are not integrated; use development links only in a controlled period.
- Payments (QPay) are not integrated; deposits are by bank transfer and checked manually.
