import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { HttpError } from "./errors";
type Database = Prisma.TransactionClient;
export const tooManyRequests =
  "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.";
// Hashed so stored keys cannot be turned back into IP addresses.
export function clientFingerprint(request: Request) {
  // Vercel sets x-forwarded-for itself; the first entry is the client.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT ?? "salon77"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
// Atomic fixed-window counter; throws 429 once the window is full.
export async function hit(
  db: Database,
  key: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(+now / windowMs) * windowMs);
  const [row] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, (${windowStart}::timestamptz AT TIME ZONE 'UTC'), 1)
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;
  // Occasionally drop windows older than a day so the table stays small.
  if (Math.random() < 0.01)
    await db.rateLimit.deleteMany({
      where: { windowStart: { lt: new Date(+now - 86400000) } },
    });
  if (Number(row.count) > limit) throw new HttpError(429, tooManyRequests);
}
// Limits for unauthenticated booking endpoints.
export const publicLimits = {
  availability: { limit: 120, windowSeconds: 600 },
  bookingPerSalon: { limit: 8, windowSeconds: 600 },
  bookingPerDay: { limit: 30, windowSeconds: 86400 },
} as const;
export async function guardPublic(
  db: Database,
  request: Request,
  slug: string,
  kind: "availability" | "booking",
) {
  const who = clientFingerprint(request);
  if (kind === "availability") {
    const { limit, windowSeconds } = publicLimits.availability;
    return hit(db, `avail:${who}`, limit, windowSeconds);
  }
  await hit(
    db,
    `book:${slug}:${who}`,
    publicLimits.bookingPerSalon.limit,
    publicLimits.bookingPerSalon.windowSeconds,
  );
  await hit(
    db,
    `book-day:${who}`,
    publicLimits.bookingPerDay.limit,
    publicLimits.bookingPerDay.windowSeconds,
  );
}
