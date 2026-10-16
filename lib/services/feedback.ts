import type { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "../errors";
import { refreshActor, type Actor } from "../access";
import { feedbackAnswer, feedbackInput } from "../feedback";
import { assertPlatformAdmin, platformNotFound } from "./platform";
type Database = Prisma.TransactionClient;
// Enough for real use; stops one account from flooding the inbox.
const DAILY_LIMIT = 10;
const view = (f: {
  id: string;
  kind: string;
  message: string;
  status: string;
  reply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
}) => ({
  id: f.id,
  kind: f.kind,
  message: f.message,
  status: f.status,
  reply: f.reply ?? "",
  repliedAt: f.repliedAt?.toISOString() ?? null,
  createdAt: f.createdAt.toISOString(),
});
// Owners and managers see everything their salon sent; others see their own.
export async function listOwnFeedback(db: Database, actor: Actor) {
  const rows = await db.feedback.findMany({
    where: {
      salonId: actor.salonId,
      ...(["SALON_OWNER", "MANAGER"].includes(actor.role)
        ? {}
        : { userId: actor.userId }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 50,
    include: { user: { select: { name: true } } },
  });
  return rows.map((f) => ({ ...view(f), author: f.user.name ?? "" }));
}
export type OwnFeedback = Awaited<ReturnType<typeof listOwnFeedback>>;
export async function sendFeedback(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  now = new Date(),
) {
  const input = feedbackInput.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    const today = await tx.feedback.count({
      where: {
        userId: current.userId,
        createdAt: { gte: new Date(+now - 86400000) },
      },
    });
    if (today >= DAILY_LIMIT)
      throw new HttpError(
        429,
        "Өнөөдөр илгээх хүсэлтийн тоо дууслаа. Маргааш дахин оролдоно уу.",
      );
    await tx.feedback.create({
      data: {
        salonId: current.salonId,
        userId: current.userId,
        kind: input.kind,
        message: input.message,
        createdAt: now,
      },
    });
    return listOwnFeedback(tx, current);
  });
}
// Platform inbox: open requests first, oldest first; then answered ones.
export async function listFeedback(db: Database, adminUserId: string) {
  await assertPlatformAdmin(db, adminUserId);
  const include = {
    salon: { select: { id: true, name: true, phone: true } },
    user: { select: { name: true, email: true } },
  } as const;
  const [open, done] = await Promise.all([
    db.feedback.findMany({
      where: { status: "OPEN" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 200,
      include,
    }),
    db.feedback.findMany({
      where: { status: "DONE" },
      orderBy: [{ repliedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      include,
    }),
  ]);
  return [...open, ...done].map((f) => ({
    ...view(f),
    unread: f.readAt === null,
    salonId: f.salon.id,
    salonName: f.salon.name,
    salonPhone: f.salon.phone,
    authorName: f.user.name ?? "",
    authorEmail: f.user.email,
  }));
}
export type PlatformFeedback = Awaited<ReturnType<typeof listFeedback>>;
export async function unreadFeedbackCount(db: Database, adminUserId: string) {
  await assertPlatformAdmin(db, adminUserId);
  return db.feedback.count({ where: { readAt: null } });
}
// Opening the inbox marks what was shown as read; the page still flags them
// as new for this visit.
export async function markFeedbackRead(
  db: Database,
  adminUserId: string,
  ids: string[],
  now = new Date(),
) {
  await assertPlatformAdmin(db, adminUserId);
  if (!ids.length) return 0;
  return (
    await db.feedback.updateMany({
      where: { id: { in: ids }, readAt: null },
      data: { readAt: now },
    })
  ).count;
}
export async function answerFeedback(
  db: PrismaClient,
  adminUserId: string,
  id: string,
  raw: unknown,
  now = new Date(),
) {
  const input = feedbackAnswer.parse(raw);
  return db.$transaction(async (tx) => {
    await assertPlatformAdmin(tx, adminUserId);
    const row = await tx.feedback.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new HttpError(404, platformNotFound);
    const saved = await tx.feedback.update({
      where: { id },
      data: {
        status: input.status,
        reply: input.reply || null,
        repliedAt: input.reply || input.status === "DONE" ? now : null,
      },
    });
    return view(saved);
  });
}
