import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { type Actor, refreshActor, requireOwner } from "../access";
import { HttpError } from "../errors";
import { applicationFields, socialUrl } from "../salon-application";
import { onboardingSchema } from "../validation";
// The salon's Instagram and Facebook, shown on its booking page. Either may
// be empty; whatever is given must point at that network.
export const socialInput = z
  .object({
    instagram: applicationFields.instagram,
    facebook: applicationFields.facebook,
  })
  .strict()
  .refine((v) => !v.instagram || socialUrl("instagram", v.instagram), {
    message: "Инстаграм хаягаа зөв оруулна уу. Жишээ: @tanii.salon",
    path: ["instagram"],
  })
  .refine((v) => !v.facebook || socialUrl("facebook", v.facebook), {
    message: "Фэйсбүүк хуудасныхаа хаягийг зөв оруулна уу.",
    path: ["facebook"],
  });
export async function updateSalonSocial(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
) {
  const input = socialInput.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    await tx.salon.update({
      where: { id: current.salonId },
      data: {
        instagram: input.instagram || null,
        facebook: input.facebook || null,
      },
    });
    return { instagram: input.instagram, facebook: input.facebook };
  });
}
// Name, phone and introduction shown on the booking page. Renaming keeps
// the booking link: changing it is a separate, deliberate step.
export const detailsInput = z
  .object({
    name: z.string().trim().min(1, "Салоны нэрийг оруулна уу.").max(100),
    phone: z.string().trim().min(1, "Утасны дугаараа оруулна уу.").max(30),
    description: z.string().trim().max(1000).default(""),
  })
  .strict();
export async function updateSalonDetails(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
) {
  const input = detailsInput.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    return tx.salon.update({
      where: { id: current.salonId },
      data: {
        name: input.name,
        phone: input.phone,
        description: input.description || null,
      },
      select: { name: true, phone: true, description: true, slug: true },
    });
  });
}
// The old link stops working, so the owner must confirm the change.
export const slugInput = z
  .object({
    slug: onboardingSchema.shape.slug,
    confirm: z.literal(true, {
      message: "Линк солихыг баталгаажуулна уу.",
    }),
  })
  .strict();
export async function changeSalonSlug(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
) {
  const input = slugInput.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    const taken = await tx.salon.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (taken && taken.id !== current.salonId)
      throw new HttpError(409, "Энэ линкийг өөр салон ашиглаж байна.");
    return tx.salon.update({
      where: { id: current.salonId },
      data: { slug: input.slug },
      select: { slug: true },
    });
  });
}
