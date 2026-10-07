import type { Prisma, PrismaClient } from "@prisma/client";
import { type Actor, refreshActor, requireOwner } from "../access";
import {
  bookingSettingsSchema,
  defaultBookingSettings,
  policyView,
} from "../booking-settings";
export async function salonBookingPolicy(
  db: Prisma.TransactionClient,
  salonId: string,
) {
  const row = await db.bookingSettings.findUnique({ where: { salonId } });
  return row
    ? policyView(row as Parameters<typeof policyView>[0])
    : { ...defaultBookingSettings };
}
export async function readBookingSettings(db: PrismaClient, actor: Actor) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  return salonBookingPolicy(db, current.salonId);
}
export async function saveBookingSettings(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
) {
  const input = bookingSettingsSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    const row = await tx.bookingSettings.upsert({
      where: { salonId: current.salonId },
      create: { salonId: current.salonId, ...input },
      update: input,
    });
    return policyView(row as Parameters<typeof policyView>[0]);
  });
}
