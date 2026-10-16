import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  type Actor,
  branchWhere,
  refreshActor,
  requireOwner,
  requireOwnBranches,
} from "../access";
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
// Size and file-type checks shared by every upload.
function checkedImage(bytes: Uint8Array) {
  if (!bytes.length) throw new HttpError(400, "Зургаа сонгоно уу.");
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new HttpError(413, "Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
  const type = imageType(bytes);
  if (!type)
    throw new HttpError(
      400,
      "Зөвхөн зургийн файл (жпег, пнг, вебп) оруулна уу.",
    );
  return type;
}
const notConfigured =
  "Зураг хадгалах үйлчилгээ серверт тохируулагдаагүй тул зураг хадгалагдсангүй. Системийн админтай холбогдоно уу.";
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
// Receptionists change photos of their own branch's staff and services.
async function requirePhotoAccess(
  db: PrismaClient,
  actor: Actor,
  target: PhotoTarget,
  id: string,
) {
  if (
    actor.role === "RECEPTIONIST" &&
    (target === "staff" || target === "service")
  ) {
    const where = { salonId: actor.salonId };
    const rows =
      target === "staff"
        ? await db.staffBranch.findMany({ where: { ...where, staffId: id } })
        : await db.serviceBranch.findMany({
            where: { ...where, serviceId: id },
          });
    return requireOwnBranches(
      actor,
      rows.map((r) => r.branchId),
    );
  }
  requireOwner(actor);
}
export async function setPhoto(
  db: PrismaClient,
  actor: Actor,
  target: PhotoTarget,
  id: string,
  bytes: Uint8Array,
  store: MediaStore | null,
) {
  // A branch's photo is the first photo of its gallery.
  if (target === "branch") {
    const photos = await addBranchImage(db, actor, id, bytes, store);
    const added = await moveBranchImage(db, actor, photos.at(-1)!.id, "first");
    return { imageUrl: added[0].url };
  }
  const current = await refreshActor(db, actor);
  await requirePhotoAccess(db, current, target, id);
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
  if (target === "branch") {
    const [main] = await readBranchGallery(db, actor, id);
    if (main) await removeBranchImage(db, actor, main.id, store);
    return { imageUrl: null };
  }
  const current = await refreshActor(db, actor);
  await requirePhotoAccess(db, current, target, id);
  const before = await photoRow(db, target, current.salonId, id);
  await savePhoto(db, target, id, null);
  if (store) await forgetOld(store, current.salonId, before.imageUrl);
  return { imageUrl: null };
}
// Branch galleries: photos of one branch's space, up to 10, in the owner's
// order. The first photo is the branch's main photo; Branch.imageUrl mirrors
// it for the booking page top and link previews.
export const MAX_BRANCH_IMAGES = 10;
export type BranchPhoto = { id: string; url: string };
const photoOrder = [
  { sortOrder: "asc" as const },
  { createdAt: "asc" as const },
];
async function ownBranch(db: PrismaClient, actor: Actor, branchId: string) {
  const branch = await db.branch.findFirst({
    where: { id: branchId, salonId: actor.salonId },
    select: { id: true },
  });
  if (!branch) throw new HttpError(404, "Салбар олдсонгүй.");
}
async function branchPhotos(
  db: Prisma.TransactionClient,
  salonId: string,
  branchId: string,
) {
  return db.branchImage.findMany({
    where: { salonId, branchId },
    orderBy: photoOrder,
    select: { id: true, url: true },
  });
}
// Renumbers the photos densely in the given order and mirrors the first.
async function saveOrder(
  db: Prisma.TransactionClient,
  salonId: string,
  branchId: string,
  rows: BranchPhoto[],
) {
  for (const [i, row] of rows.entries())
    await db.branchImage.update({
      where: { id: row.id },
      data: { sortOrder: i },
    });
  await db.branch.updateMany({
    where: { id: branchId, salonId },
    data: { imageUrl: rows[0]?.url ?? null },
  });
  return rows;
}
// Every branch the member may see, keyed by branch id; for the branches page.
export async function readBranchGalleries(db: PrismaClient, actor: Actor) {
  const rows = await db.branchImage.findMany({
    where: { salonId: actor.salonId, branch: branchWhere(actor) },
    orderBy: photoOrder,
    select: { id: true, url: true, branchId: true },
  });
  const byBranch: Record<string, BranchPhoto[]> = {};
  for (const { branchId, ...photo } of rows)
    (byBranch[branchId] ??= []).push(photo);
  return byBranch;
}
export async function readBranchGallery(
  db: PrismaClient,
  actor: Actor,
  branchId: string,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  await ownBranch(db, current, branchId);
  return branchPhotos(db, current.salonId, branchId);
}
export async function addBranchImage(
  db: PrismaClient,
  actor: Actor,
  branchId: string,
  bytes: Uint8Array,
  store: MediaStore | null,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  if (!store) throw new HttpError(503, notConfigured);
  await ownBranch(db, current, branchId);
  const type = checkedImage(bytes);
  const existing = await branchPhotos(db, current.salonId, branchId);
  if (existing.length >= MAX_BRANCH_IMAGES)
    throw new HttpError(
      409,
      `Салбар бүрт ${MAX_BRANCH_IMAGES} хүртэл зураг оруулна. Шинэ зураг нэмэхийн тулд нэгийг устгана уу.`,
    );
  const url = await store
    .upload(
      `${current.salonId}/branch-${randomUUID()}.${type.ext}`,
      bytes,
      type.mime,
    )
    .catch(() => {
      throw new HttpError(502, "Зургийг хадгалж чадсангүй. Дахин оролдоно уу.");
    });
  const added = await db.branchImage.create({
    data: {
      salonId: current.salonId,
      branchId,
      url,
      sortOrder: existing.length,
    },
    select: { id: true, url: true },
  });
  return saveOrder(db, current.salonId, branchId, [...existing, added]);
}
export async function removeBranchImage(
  db: PrismaClient,
  actor: Actor,
  id: string,
  store: MediaStore | null,
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  const image = await db.branchImage.findFirst({
    where: { id, salonId: current.salonId },
  });
  if (!image) throw new HttpError(404, "Зураг олдсонгүй.");
  await db.branchImage.delete({ where: { id: image.id } });
  const rows = await saveOrder(
    db,
    current.salonId,
    image.branchId,
    await branchPhotos(db, current.salonId, image.branchId),
  );
  if (store) await forgetOld(store, current.salonId, image.url);
  return rows;
}
// One step earlier or later, or straight to the front as the main photo.
export async function moveBranchImage(
  db: PrismaClient,
  actor: Actor,
  id: string,
  direction: "earlier" | "later" | "first",
) {
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    const image = await tx.branchImage.findFirst({
      where: { id, salonId: current.salonId },
      select: { branchId: true },
    });
    if (!image) throw new HttpError(404, "Зураг олдсонгүй.");
    const rows = await branchPhotos(tx, current.salonId, image.branchId);
    const from = rows.findIndex((r) => r.id === id);
    const to =
      direction === "first" ? 0 : from + (direction === "earlier" ? -1 : 1);
    if (to < 0 || to >= rows.length || to === from) return rows;
    const [moved] = rows.splice(from, 1);
    rows.splice(to, 0, moved);
    return saveOrder(tx, current.salonId, image.branchId, rows);
  });
}
