import type { PrismaClient } from "@prisma/client";
import { type Actor, refreshActor, requireOwner } from "../access";
// Phone numbers are masked; owners only need to see that delivery happened.
export function maskPhone(phone: string) {
  return phone.length > 4 ? `${"•".repeat(4)}${phone.slice(-4)}` : phone;
}
export async function readNotificationLog(db: PrismaClient, actor: Actor) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  const rows = await db.notification.findMany({
    where: { salonId: current.salonId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 30,
  });
  return rows.map((n) => ({
    id: n.id,
    event: n.event,
    recipient: maskPhone(n.recipient),
    body: n.body,
    status: n.status,
    attempts: n.attempts,
    lastError: n.lastError,
    createdAt: n.createdAt.toISOString(),
    sentAt: n.sentAt?.toISOString() ?? null,
  }));
}
export type NotificationLog = Awaited<ReturnType<typeof readNotificationLog>>;
