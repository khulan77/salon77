import { Prisma, type Notification, type PrismaClient } from "@prisma/client";
import type { SmsProvider } from "./provider";
export const MAX_ATTEMPTS = 5;
const STUCK_AFTER_MS = 10 * 60000;
export const providerMissing = "Мессеж илгээх үйлчилгээ тохируулаагүй.";
// Claims due notices with SKIP LOCKED so concurrent workers never send twice.
async function claim(db: PrismaClient, limit: number, now: Date) {
  await db.notification.updateMany({
    where: {
      status: "SENDING",
      claimedAt: { lt: new Date(+now - STUCK_AFTER_MS) },
    },
    data: { status: "PENDING" },
  });
  // Columns are UTC TIMESTAMP(3); convert explicitly so the session time zone
  // can never shift the comparison.
  const utc = Prisma.sql`(${now}::timestamptz AT TIME ZONE 'UTC')`;
  return db.$queryRaw<Notification[]>`
    UPDATE "Notification"
    SET "status" = 'SENDING', "claimedAt" = ${utc}, "attempts" = "attempts" + 1, "updatedAt" = ${utc}
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE "status" = 'PENDING' AND "availableAt" <= ${utc}
      ORDER BY "availableAt", "id"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}
export async function processNotifications(
  db: PrismaClient,
  provider: SmsProvider | null,
  { limit = 20, now = new Date() } = {},
) {
  const due = await claim(db, limit, now);
  let sent = 0;
  for (const n of due) {
    if (!provider) {
      await db.notification.update({
        where: { id: n.id },
        data: { status: "SKIPPED", lastError: providerMissing },
      });
      continue;
    }
    try {
      const { messageId } = await provider.send(n.recipient, n.body);
      await db.notification.update({
        where: { id: n.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: messageId ?? null,
          lastError: null,
        },
      });
      sent++;
    } catch (e) {
      // Exponential backoff: 2, 4, 8, 16 minutes, then give up.
      const final = n.attempts >= MAX_ATTEMPTS;
      await db.notification.update({
        where: { id: n.id },
        data: {
          status: final ? "FAILED" : "PENDING",
          availableAt: new Date(+now + 2 ** n.attempts * 60000),
          lastError: (e instanceof Error
            ? e.message
            : "Илгээж чадсангүй"
          ).slice(0, 300),
        },
      });
    }
  }
  return { claimed: due.length, sent };
}
