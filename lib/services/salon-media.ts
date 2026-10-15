import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { type Actor, refreshActor, requireOwner } from "../access";
import { HttpError } from "../errors";
import type { MediaStore } from "../storage";
// Vercel rejects request bodies above 4.5MB, so stay below it.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Detect the type from the file's bytes; browser-supplied MIME types are untrusted.
export function imageType(bytes: Uint8Array) {
  const at = (i: number, ...values: number[]) =>
    values.every((v, j) => bytes[i + j] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { mime: "image/png", ext: "png" };
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50))
    return { mime: "image/webp", ext: "webp" };
  return null;
}
const notConfigured =
  "Зураг хадгалах тохиргоо хийгдээгүй байна. Системийн админтай холбогдоно уу.";
async function forgetOld(
  store: MediaStore,
  salonId: string,
  url?: string | null,
) {
  const path = url && store.pathOf(url);
  // Only delete objects inside this salon's folder.
  if (path && path.startsWith(`${salonId}/`))
    await store.remove(path).catch(() => undefined);
}
export async function setSalonCover(
  db: PrismaClient,
  actor: Actor,
  bytes: Uint8Array,
  store: MediaStore | null,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  if (!store) throw new HttpError(503, notConfigured);
  if (!bytes.length) throw new HttpError(400, "Зургаа сонгоно уу.");
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new HttpError(413, "Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
  const type = imageType(bytes);
  if (!type)
    throw new HttpError(
      400,
      "Зөвхөн зургийн файл (жпег, пнг, вебп) оруулна уу.",
    );
  const url = await store
    .upload(
      `${current.salonId}/cover-${randomUUID()}.${type.ext}`,
      bytes,
      type.mime,
    )
    .catch(() => {
      throw new HttpError(502, "Зургийг хадгалж чадсангүй. Дахин оролдоно уу.");
    });
  const before = await db.salon.findUniqueOrThrow({
    where: { id: current.salonId },
    select: { coverUrl: true },
  });
  await db.salon.update({
    where: { id: current.salonId },
    data: { coverUrl: url },
  });
  await forgetOld(store, current.salonId, before.coverUrl);
  return { coverUrl: url };
}
export async function removeSalonCover(
  db: PrismaClient,
  actor: Actor,
  store: MediaStore | null,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  const before = await db.salon.findUniqueOrThrow({
    where: { id: current.salonId },
    select: { coverUrl: true },
  });
  await db.salon.update({
    where: { id: current.salonId },
    data: { coverUrl: null },
  });
  if (store) await forgetOld(store, current.salonId, before.coverUrl);
  return { coverUrl: null };
}
// Gallery: photos of the salon's space and work.
export const MAX_GALLERY_IMAGES = 10;
const galleryView = (rows: { id: string; url: string }[]) =>
  rows.map((r) => ({ id: r.id, url: r.url }));
export async function readGallery(db: PrismaClient, actor: Actor) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  return galleryView(
    await db.salonImage.findMany({
      where: { salonId: current.salonId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  );
}
export async function addGalleryImage(
  db: PrismaClient,
  actor: Actor,
  bytes: Uint8Array,
  store: MediaStore | null,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  if (!store) throw new HttpError(503, notConfigured);
  if (!bytes.length) throw new HttpError(400, "Зургаа сонгоно уу.");
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new HttpError(413, "Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
  const type = imageType(bytes);
  if (!type)
    throw new HttpError(
      400,
      "Зөвхөн зургийн файл (жпег, пнг, вебп) оруулна уу.",
    );
  const existing = await db.salonImage.findMany({
    where: { salonId: current.salonId },
    select: { sortOrder: true },
  });
  if (existing.length >= MAX_GALLERY_IMAGES)
    throw new HttpError(
      409,
      `Цомогт ${MAX_GALLERY_IMAGES} хүртэл зураг оруулна. Шинэ зураг нэмэхийн тулд нэгийг устгана уу.`,
    );
  const url = await store
    .upload(
      `${current.salonId}/gallery-${randomUUID()}.${type.ext}`,
      bytes,
      type.mime,
    )
    .catch(() => {
      throw new HttpError(502, "Зургийг хадгалж чадсангүй. Дахин оролдоно уу.");
    });
  await db.salonImage.create({
    data: {
      salonId: current.salonId,
      url,
      sortOrder: Math.max(-1, ...existing.map((e) => e.sortOrder)) + 1,
    },
  });
  return readGallery(db, current);
}
export async function removeGalleryImage(
  db: PrismaClient,
  actor: Actor,
  id: string,
  store: MediaStore | null,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  const image = await db.salonImage.findFirst({
    where: { id, salonId: current.salonId },
  });
  if (!image) throw new HttpError(404, "Зураг олдсонгүй.");
  await db.salonImage.delete({ where: { id: image.id } });
  if (store) await forgetOld(store, current.salonId, image.url);
  return readGallery(db, current);
}
// Moves one photo a step earlier or later; the first photo leads the gallery.
export async function moveGalleryImage(
  db: PrismaClient,
  actor: Actor,
  id: string,
  direction: "earlier" | "later",
) {
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    const rows = await tx.salonImage.findMany({
      where: { salonId: current.salonId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, url: true },
    });
    const from = rows.findIndex((r) => r.id === id);
    if (from < 0) throw new HttpError(404, "Зураг олдсонгүй.");
    const to = from + (direction === "earlier" ? -1 : 1);
    if (to >= 0 && to < rows.length) {
      [rows[from], rows[to]] = [rows[to], rows[from]];
      // Renumber everything so the order is always dense and unambiguous.
      for (const [i, row] of rows.entries())
        await tx.salonImage.update({
          where: { id: row.id },
          data: { sortOrder: i },
        });
    }
    return galleryView(rows);
  });
}
// Photos of a single service or staff member, shown on the booking page.
// "logo" is the salon itself; its id must be the actor's salon.
export type PhotoTarget = "service" | "staff" | "product" | "branch" | "logo";
async function photoRow(
  db: PrismaClient,
  target: PhotoTarget,
  salonId: string,
  id: string,
) {
  const where = { id, salonId };
  const select = { imageUrl: true };
  if (target === "logo") {
    const salon =
      id === salonId
        ? await db.salon.findUnique({
            where: { id },
            select: { logoUrl: true },
          })
        : null;
    if (!salon) throw new HttpError(404, "Салон олдсонгүй.");
    return { imageUrl: salon.logoUrl };
  }
  const row =
    target === "service"
      ? await db.service.findFirst({ where, select })
      : target === "staff"
        ? await db.staff.findFirst({ where, select })
        : target === "product"
          ? await db.product.findFirst({ where, select })
          : await db.branch.findFirst({ where, select });
  if (!row)
    throw new HttpError(
      404,
      {
        service: "Үйлчилгээ олдсонгүй.",
        staff: "Ажилтан олдсонгүй.",
        product: "Бараа олдсонгүй.",
        branch: "Салбар олдсонгүй.",
      }[target as "service" | "staff" | "product" | "branch"],
    );
  return row;
}
const savePhoto = (
  db: PrismaClient,
  target: PhotoTarget,
  id: string,
  imageUrl: string | null,
) =>
  target === "service"
    ? db.service.update({ where: { id }, data: { imageUrl } })
    : target === "staff"
      ? db.staff.update({ where: { id }, data: { imageUrl } })
      : target === "product"
        ? db.product.update({ where: { id }, data: { imageUrl } })
        : target === "branch"
          ? db.branch.update({ where: { id }, data: { imageUrl } })
          : db.salon.update({ where: { id }, data: { logoUrl: imageUrl } });
export async function setPhoto(
  db: PrismaClient,
  actor: Actor,
  target: PhotoTarget,
  id: string,
  bytes: Uint8Array,
  store: MediaStore | null,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  if (!store) throw new HttpError(503, notConfigured);
  const before = await photoRow(db, target, current.salonId, id);
  if (!bytes.length) throw new HttpError(400, "Зургаа сонгоно уу.");
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new HttpError(413, "Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
  const type = imageType(bytes);
  if (!type)
    throw new HttpError(
      400,
      "Зөвхөн зургийн файл (жпег, пнг, вебп) оруулна уу.",
    );
  const imageUrl = await store
    .upload(
      `${current.salonId}/${target}-${randomUUID()}.${type.ext}`,
      bytes,
      type.mime,
    )
    .catch(() => {
      throw new HttpError(502, "Зургийг хадгалж чадсангүй. Дахин оролдоно уу.");
    });
  await savePhoto(db, target, id, imageUrl);
  await forgetOld(store, current.salonId, before.imageUrl);
  return { imageUrl };
}
export async function removePhoto(
  db: PrismaClient,
  actor: Actor,
  target: PhotoTarget,
  id: string,
  store: MediaStore | null,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  const before = await photoRow(db, target, current.salonId, id);
  await savePhoto(db, target, id, null);
  if (store) await forgetOld(store, current.salonId, before.imageUrl);
  return { imageUrl: null };
}
