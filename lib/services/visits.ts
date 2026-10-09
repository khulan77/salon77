import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Booking, PrismaClient } from "@prisma/client";
import { HttpError } from "../errors";
import { customerInput, dateSchema } from "../booking-validation";
import { localStamp } from "../business-time";
import { depositAmount, publicBookingClosed } from "../booking-settings";
import { discountedPrice } from "../pricing";
import { assertGuestQuota, assertHuman } from "./guest-guard";
import { enqueueNotice } from "../notifications/outbox";
import { recordActivity } from "./activity";
import {
  bookingConflict,
  lockStaff,
  publicReceipt,
  resolveContext,
  resources,
  slots,
  transaction,
} from "./bookings";
type Database = Parameters<typeof resolveContext>[0];
type Clock = { now?: () => Date };
// A visit is 1–2 services started together, each by a different staff member.
const id = z.string().min(1).max(100);
const items = z
  .array(z.object({ serviceId: id, staffId: id.optional() }).strict())
  .min(1, "Үйлчилгээгээ сонгоно уу.")
  .max(2, "Нэг удаад 2 хүртэл үйлчилгээ захиална.")
  .refine(
    (v) => new Set(v.map((i) => i.serviceId)).size === v.length,
    "Нэг үйлчилгээг давхар сонгох боломжгүй.",
  )
  .refine(
    (v) => v.length < 2 || !v[0].staffId || v[0].staffId !== v[1].staffId,
    "Хоёр үйлчилгээг өөр өөр ажилтан хийнэ.",
  );
export const visitAvailabilitySchema = z
  .object({ branchId: id, date: dateSchema, items })
  .strict();
export const visitSchema = z
  .object({
    branchId: id,
    items,
    startAt: z.iso.datetime({ offset: true }),
    customer: customerInput,
    idempotencyKey: z.uuid(),
    // Honeypot: hidden from people, so any value means an automated client.
    website: z.string().max(200).optional(),
  })
  .strict();
type Slot = { startAt: string; staffIds: string[] };
// Distinct staff per service, deterministic (lists are sorted by staff ID).
// Backtracks so A:[x,y] + B:[x] yields [y,x] rather than failing on [x,?].
export function assignStaff(
  options: string[][],
  chosen: string[] = [],
): string[] | null {
  if (chosen.length === options.length) return chosen;
  for (const pick of options[chosen.length])
    if (!chosen.includes(pick)) {
      const found = assignStaff(options, [...chosen, pick]);
      if (found) return found;
    }
  return null;
}
function combine(lists: Slot[][]) {
  const maps = lists.map((l) => new Map(l.map((s) => [s.startAt, s.staffIds])));
  return lists[0]
    .map((s) => s.startAt)
    .flatMap((startAt) => {
      const staff = assignStaff(maps.map((m) => m.get(startAt) ?? []));
      return staff ? [{ startAt, staff }] : [];
    });
}
export async function visitSlots(
  db: Database,
  scope: Awaited<ReturnType<typeof resolveContext>>,
  input: z.infer<typeof visitAvailabilitySchema>,
  now?: Date,
  excludeIds: string[] = [],
) {
  const results = [];
  for (const item of input.items)
    results.push(
      await slots(
        db,
        scope,
        { branchId: input.branchId, date: input.date, ...item },
        { now, excludeIds },
      ),
    );
  return { results, slots: combine(results.map((r) => r.slots)) };
}
export async function visitAvailability(
  db: Database,
  slug: string,
  raw: unknown,
  clock: Clock = {},
) {
  const input = visitAvailabilitySchema.parse(raw);
  const scope = await resolveContext(db, { slug });
  const { results, slots } = await visitSlots(db, scope, input, clock.now?.());
  return {
    durationMinutes: Math.max(...results.map((r) => r.service.durationMinutes)),
    slots: slots.map((s) => ({ startAt: s.startAt })),
  };
}
export async function createVisit(
  db: PrismaClient,
  slug: string,
  raw: unknown,
  clock: Clock = {},
): Promise<Booking[] & { manageToken: string | null }> {
  const { website, ...input } = visitSchema.parse(raw);
  assertHuman(website);
  return transaction(db, async (tx) => {
    const scope = await resolveContext(tx, { slug });
    if (!scope.policy.publicBookingEnabled)
      throw new HttpError(403, publicBookingClosed);
    const hash = createHash("sha256")
      .update(JSON.stringify({ input, principal: "public" }))
      .digest("hex");
    const existing = await tx.booking.findUnique({
      where: {
        salonId_idempotencyKey: {
          salonId: scope.salonId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestHash !== hash)
        throw new HttpError(
          409,
          "Давтан хүсэлтийн мэдээлэл зөрж байна. Шинэ захиалга эхлүүлнэ үү.",
        );
      // A replay cannot reveal the token again: only its hash is stored.
      const again = existing.groupId
        ? await tx.booking.findMany({
            where: { salonId: scope.salonId, groupId: existing.groupId },
            orderBy: { idempotencyKey: "asc" },
          })
        : [existing];
      return Object.assign(again, { manageToken: null });
    }
    const candidates = new Set<string>();
    for (const item of input.items)
      for (const s of (
        await resources(tx, scope, input.branchId, item.serviceId, item.staffId)
      ).staff)
        candidates.add(s.id);
    // Lock every candidate before re-checking so parallel visits cannot interleave.
    await lockStaff(tx, [...candidates]);
    const startAt = new Date(input.startAt);
    const { results, slots: open } = await visitSlots(
      tx,
      scope,
      {
        branchId: input.branchId,
        date: localStamp(startAt).slice(0, 10),
        items: input.items,
      },
      clock.now?.(),
    );
    const slot = open.find((s) => s.startAt === startAt.toISOString());
    if (!slot) throw new HttpError(409, bookingConflict);
    await assertGuestQuota(
      tx,
      scope.salonId,
      input.customer.phone,
      input.items.length,
      clock.now?.(),
    );
    const customer = await tx.customer.upsert({
      where: {
        salonId_phone: { salonId: scope.salonId, phone: input.customer.phone },
      },
      create: {
        salonId: scope.salonId,
        name: input.customer.name,
        phone: input.customer.phone,
        email: input.customer.email || null,
      },
      update: {},
    });
    const groupId = input.items.length > 1 ? randomUUID() : null;
    // Private link letting the guest cancel or move this visit later.
    const manageToken = randomBytes(32).toString("base64url");
    const manageTokenHash = hashManageToken(manageToken);
    const created: Booking[] = [];
    for (const [i, { service }] of results.entries()) {
      const price = discountedPrice(service.priceMnt, service.discountPercent);
      const deposit = depositAmount(price, scope.policy);
      created.push(
        await tx.booking.create({
          data: {
            salonId: scope.salonId,
            branchId: input.branchId,
            serviceId: service.id,
            staffId: slot.staff[i],
            customerId: customer.id,
            startAt,
            endAt: new Date(+startAt + service.durationMinutes * 60000),
            status:
              deposit > 0 ||
              scope.policy.bookingConfirmationMode === "MANUAL_CONFIRM"
                ? "PENDING"
                : "CONFIRMED",
            source: "ONLINE",
            serviceNameSnapshot: service.name,
            durationMinutesSnapshot: service.durationMinutes,
            priceSnapshot: price,
            discountPercentSnapshot: service.discountPercent,
            depositAmountSnapshot: deposit,
            customerNameSnapshot: input.customer.name,
            customerPhoneSnapshot: input.customer.phone,
            notes: "",
            // The first booking carries the client key; the second derives from it.
            idempotencyKey: i
              ? `${input.idempotencyKey}:${i + 1}`
              : input.idempotencyKey,
            requestHash: hash,
            groupId,
            manageTokenHash,
          },
        }),
      );
    }
    await recordActivity(tx, created[0], "ONLINE_CREATED");
    await enqueueNotice(
      tx,
      created,
      created.every((b) => b.status === "CONFIRMED")
        ? "BOOKING_CONFIRMED"
        : "BOOKING_RECEIVED",
      { manageUrl: absoluteManageUrl(slug, manageToken) },
    );
    return Object.assign(created, { manageToken });
  });
}
export async function visitReceipt(db: Database, bookings: Booking[]) {
  const parts = await Promise.all(bookings.map((b) => publicReceipt(db, b)));
  const deposits = parts.map((p) => p.deposit).filter((d) => d !== null);
  return {
    salonName: parts[0].salonName,
    branchName: parts[0].branchName,
    startAt: parts[0].startAt,
    status: parts.every((p) => p.status === "CONFIRMED")
      ? "CONFIRMED"
      : "PENDING",
    totalMnt: parts.reduce((sum, p) => sum + p.priceMnt, 0),
    items: parts.map((p) => ({
      serviceName: p.serviceName,
      staffName: p.staffName,
      priceMnt: p.priceMnt,
      endAt: p.endAt,
    })),
    deposit: deposits.length
      ? {
          ...deposits[0],
          amountMnt: deposits.reduce((sum, d) => sum + d.amountMnt, 0),
        }
      : null,
  };
}
export type VisitReceipt = Awaited<ReturnType<typeof visitReceipt>>;
export function hashManageToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function managePath(slug: string, token: string) {
  return `/${slug}/manage?token=${token}`;
}
// Messages need an absolute link; omitted until APP_URL is configured.
function absoluteManageUrl(slug: string, token: string) {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return base && /^https?:\/\//.test(base)
    ? base + managePath(slug, token)
    : undefined;
}
