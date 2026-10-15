import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { type Actor, refreshActor, requireOwner } from "../access";
import { applicationFields, socialUrl } from "../salon-application";
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
