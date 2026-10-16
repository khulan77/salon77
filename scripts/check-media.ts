// Read-only diagnosis of photo storage for the environment in process.env.
// Usage: vercel env pull .env.production.local
//        node --env-file=.env.production.local --import tsx scripts/check-media.ts
// Prints hosts and statuses only, never keys or connection strings.
import { PrismaClient } from "@prisma/client";
import { MEDIA_BUCKET, storageConfig } from "../lib/storage";
const config = storageConfig();
const ok = (pass: boolean, text: string) =>
  console.log(`${pass ? "✓" : "✗"} ${text}`);
async function main() {
  ok(
    config.ok,
    config.ok
      ? "upload key is an sb_secret_ key"
      : `upload disabled: ${config.problem}`,
  );
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const host = base ? new URL(base).host : "";
  if (config.ok) {
    const res = await fetch(`${config.url}/storage/v1/bucket/${MEDIA_BUCKET}`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    });
    const bucket = (await res.json().catch(() => ({}))) as { public?: boolean };
    ok(res.ok, `bucket "${MEDIA_BUCKET}" exists (HTTP ${res.status})`);
    if (res.ok)
      ok(bucket.public === true, `bucket "${MEDIA_BUCKET}" is public`);
  }
  const db = new PrismaClient();
  try {
    const rows = await db.$queryRaw<{ url: string }[]>`
      SELECT "logoUrl" AS url FROM "Salon" WHERE "logoUrl" IS NOT NULL
      UNION ALL SELECT "coverUrl" FROM "Salon" WHERE "coverUrl" IS NOT NULL
      UNION ALL SELECT "url" FROM "SalonImage"
      UNION ALL SELECT "imageUrl" FROM "Service" WHERE "imageUrl" IS NOT NULL
      UNION ALL SELECT "imageUrl" FROM "Staff" WHERE "imageUrl" IS NOT NULL`;
    const hosts = new Map<string, number>();
    for (const { url } of rows) {
      const key = URL.canParse(url) ? new URL(url).host : "invalid";
      hosts.set(key, (hosts.get(key) ?? 0) + 1);
    }
    console.log(
      `  ${rows.length} stored photo URLs by host:`,
      Object.fromEntries(hosts),
    );
    const foreign = rows.length - (hosts.get(host) ?? 0);
    ok(!foreign, `all stored photos point at this project's storage (${host})`);
    const sample = rows.find((r) => r.url.includes("/object/public/"));
    if (sample) {
      const res = await fetch(sample.url, { method: "HEAD" });
      ok(res.ok, `a stored photo opens without login (HTTP ${res.status})`);
    }
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    "check failed:",
    e instanceof Error ? e.message.split("\n")[0] : e,
  );
  process.exit(1);
});
