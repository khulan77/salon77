import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { type Actor, refreshActor } from "../access";
import { assertPlatformAdmin } from "./platform";
import { formatMnt } from "../ui-language";
type Database = Prisma.TransactionClient;
// Announcements older than this stop showing on salon dashboards.
const SHOW_DAYS = 30;
export const noticeInput = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Гарчгаа оруулна уу.")
      .max(120, "Гарчиг 120 тэмдэгтээс хэтрэхгүй."),
    message: z
      .string()
      .trim()
      .min(1, "Мэдэгдлийн текстээ оруулна уу.")
      .max(2000, "Мэдэгдэл 2000 тэмдэгтээс хэтрэхгүй."),
  })
  .strict();
// The text salons get when the per-branch price changes.
export function priceNotice(pricePerBranchMnt: number) {
  return {
    title: "Сарын үнэ өөрчлөгдлөө",
    message: `Salon77-ийн сарын төлбөр нэг салбарт 30 хоног тутам ${formatMnt(pricePerBranchMnt)} боллоо. Шинэ үнэ дараагийн төлбөрөөс эхэлж хэрэгжинэ. Дэлгэрэнгүйг «Төлбөр» хэсгээс харна уу.`,
  };
}
export async function createNotice(
  db: Database,
  adminUserId: string,
  raw: unknown,
) {
  await assertPlatformAdmin(db, adminUserId);
  const input = noticeInput.parse(raw);
  return db.platformNotice.create({
    data: { ...input, createdById: adminUserId },
    select: { id: true, title: true, message: true, createdAt: true },
  });
}
// Owners of salons that are open for business: the email audience.
export async function noticeRecipients(db: Database) {
  const owners = await db.salonMember.findMany({
    where: {
      role: "SALON_OWNER",
      active: true,
      salon: { status: "ACTIVE", reviewStatus: "APPROVED" },
    },
    select: { user: { select: { email: true } } },
  });
  return [...new Set(owners.map((o) => o.user.email))];
}
export async function recordEmailed(
  db: Database,
  noticeId: string,
  emailed: number,
) {
  await db.platformNotice.update({
    where: { id: noticeId },
    data: { emailed },
  });
}
export async function listNotices(db: Database, adminUserId: string) {
  await assertPlatformAdmin(db, adminUserId);
  const rows = await db.platformNotice.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      message: true,
      emailed: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
// Recent announcements this member has not dismissed yet.
export async function unseenNotices(
  db: Database,
  member: { noticeSeenAt: Date | null },
  now = new Date(),
) {
  const since = new Date(+now - SHOW_DAYS * 86400000);
  const rows = await db.platformNotice.findMany({
    where: {
      createdAt: {
        gt:
          member.noticeSeenAt && member.noticeSeenAt > since
            ? member.noticeSeenAt
            : since,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, message: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
export async function dismissNotices(
  db: PrismaClient,
  actor: Actor,
  now = new Date(),
) {
  const current = await refreshActor(db, actor);
  await db.salonMember.update({
    where: { id: current.id },
    data: { noticeSeenAt: now },
  });
  return { success: true };
}
