import type { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "../errors";
import { requireOwner, refreshActor, type Actor } from "../access";
import { applicationSchema } from "../validation";
type Database = Prisma.TransactionClient;
const fields = {
  name: true,
  phone: true,
  description: true,
  instagram: true,
  facebook: true,
  serviceTypes: true,
  staffCount: true,
  reviewStatus: true,
  reviewNote: true,
  submittedAt: true,
  reviewedAt: true,
} as const;
// The salon's own view of its application and the platform's answer.
export async function readApplication(db: Database, actor: Actor) {
  requireOwner(actor);
  const salon = await db.salon.findUnique({
    where: { id: actor.salonId },
    select: fields,
  });
  if (!salon) throw new HttpError(404, "Салон олдсонгүй.");
  return {
    name: salon.name,
    phone: salon.phone,
    description: salon.description ?? "",
    instagram: salon.instagram ?? "",
    facebook: salon.facebook ?? "",
    serviceTypes: salon.serviceTypes,
    staffCount: salon.staffCount,
    status: salon.reviewStatus,
    note: salon.reviewNote ?? "",
    submittedAt: salon.submittedAt?.toISOString() ?? null,
    reviewedAt: salon.reviewedAt?.toISOString() ?? null,
  };
}
export type Application = Awaited<ReturnType<typeof readApplication>>;
// Corrected details go back into the review queue. An approved salon keeps
// its approval; it edits its profile elsewhere.
export async function resubmitApplication(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  now = new Date(),
) {
  const input = applicationSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    const salon = await tx.salon.findUnique({
      where: { id: current.salonId },
      select: { reviewStatus: true },
    });
    if (!salon) throw new HttpError(404, "Салон олдсонгүй.");
    if (salon.reviewStatus === "APPROVED")
      throw new HttpError(409, "Таны салон аль хэдийн баталгаажсан байна.");
    await tx.salon.update({
      where: { id: current.salonId },
      data: {
        name: input.name,
        phone: input.phone,
        description: input.description || null,
        instagram: input.instagram || null,
        facebook: input.facebook || null,
        serviceTypes: input.serviceTypes,
        staffCount: input.staffCount,
        reviewStatus: "PENDING",
        reviewNote: null,
        submittedAt: now,
      },
    });
    return readApplication(tx, current);
  });
}
