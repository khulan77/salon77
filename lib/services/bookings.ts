import { createHash } from "node:crypto";
import { Prisma, type PrismaClient, type Booking } from "@prisma/client";
import { type Actor, refreshActor, requireBranch } from "../access";
import { HttpError } from "../errors";
import {
  availabilitySchema,
  bookingSchema,
  changeBookingSchema,
  transitions,
} from "../booking-validation";
import {
  BUSINESS_TIME_ZONE,
  localStamp,
  dayWindow,
  minuteInstant,
  addDays,
} from "../business-time";
import { salonBookingPolicy } from "./booking-settings";
import { depositAmount, publicBookingClosed } from "../booking-settings";
import { discountedPrice } from "../pricing";
import { assertGuestQuota, expireStalePending } from "./guest-guard";
import { enqueueNotice } from "../notifications/outbox";
import { recordActivity } from "./activity";
type Clock = { now?: () => Date };
type Database = Prisma.TransactionClient;
export type BookingContext = { actor: Actor } | { slug: string };
export const bookingConflict =
  "Сонгосон цаг саяхан захиалагдсан байна. Өөр цаг сонгоно уу.";
export function requireBookingRole(actor: Actor) {
  if (!["SALON_OWNER", "MANAGER", "RECEPTIONIST"].includes(actor.role))
    throw new HttpError(403, "Захиалга удирдах эрхгүй байна.");
}
export function bookingScope(actor: Actor): Prisma.BookingWhereInput {
  requireBookingRole(actor);
  return {
    salonId: actor.salonId,
    ...(actor.role === "SALON_OWNER"
      ? {}
      : { branchId: { in: actor.branchIds } }),
  };
}
export async function resolveContext(db: Database, context: BookingContext) {
  if ("actor" in context) {
    const actor = await refreshActor(db, context.actor);
    requireBookingRole(actor);
    const policy = await salonBookingPolicy(db, actor.salonId);
    await expireStalePending(db, actor.salonId, policy);
    return { salonId: actor.salonId, actor, online: false, policy };
  }
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(context.slug) ||
    context.slug.length > 63
  )
    throw new HttpError(404, "Салон олдсонгүй.");
  const salon = await db.salon.findFirst({
    // A salon still under review is not reachable by the public.
    where: { slug: context.slug, status: "ACTIVE", reviewStatus: "APPROVED" },
    select: { id: true },
  });
  if (!salon) throw new HttpError(404, "Салон олдсонгүй.");
  const policy = await salonBookingPolicy(db, salon.id);
  await expireStalePending(db, salon.id, policy);
  return { salonId: salon.id, actor: null, online: true, policy };
}
type Scope = Awaited<ReturnType<typeof resolveContext>>;
export async function resources(
  db: Database,
  scope: Scope,
  branchId: string,
  serviceId: string,
  staffId?: string,
) {
  if (scope.actor) requireBranch(scope.actor, branchId);
  const service = await db.service.findFirst({
    where: {
      id: serviceId,
      salonId: scope.salonId,
      active: true,
      category: { active: true },
      ...(scope.online ? { onlineBookable: true } : {}),
      branches: {
        some: { branchId, salonId: scope.salonId, branch: { active: true } },
      },
    },
  });
  if (!service)
    throw new HttpError(404, "Сонгосон салбарт энэ үйлчилгээ боломжгүй байна.");
  const staff = await db.staff.findMany({
    where: {
      salonId: scope.salonId,
      active: true,
      ...(staffId ? { id: staffId } : {}),
      branches: {
        some: { branchId, salonId: scope.salonId, branch: { active: true } },
      },
      services: { some: { serviceId, salonId: scope.salonId } },
    },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  if (staffId && !staff.length)
    throw new HttpError(
      404,
      "Сонгосон ажилтан энэ үйлчилгээг үзүүлэх боломжгүй байна.",
    );
  return { service, staff };
}
export function fits(
  start: number,
  end: number,
  windows: { start: number; end: number }[],
  blocked: { start: number; end: number }[],
) {
  return (
    windows.some((w) => start >= w.start && end <= w.end) &&
    !blocked.some((b) => start < b.end && end > b.start)
  );
}
export async function slots(
  db: Database,
  scope: Scope,
  input: {
    branchId: string;
    serviceId: string;
    date: string;
    staffId?: string;
  },
  options: {
    excludeId?: string;
    // Bookings being moved together (a whole visit) do not block themselves.
    excludeIds?: string[];
    duration?: number;
    now?: Date;
    timeZone?: string;
  } = {},
) {
  const now = options.now ?? new Date(),
    zone = options.timeZone ?? BUSINESS_TIME_ZONE;
  if (scope.online && !scope.policy.publicBookingEnabled)
    throw new HttpError(403, publicBookingClosed);
  const today = localStamp(now, zone).slice(0, 10);
  const horizon = scope.online ? scope.policy.advanceBookingDays : 365;
  if (input.date > addDays(today, horizon))
    throw new HttpError(
      400,
      `Өнөөдрөөс хойш ${horizon} хоногийн доторх өдөр сонгоно уу.`,
    );
  const earliest =
    +now +
    (scope.online ? scope.policy.minimumBookingNoticeMinutes * 60000 : 0);
  const interval = scope.policy.slotIntervalMinutes;
  const { service, staff } = await resources(
    db,
    scope,
    input.branchId,
    input.serviceId,
    input.staffId,
  );
  const duration = options.duration ?? service.durationMinutes;
  const window = dayWindow(input.date, zone),
    staffIds = staff.map((s) => s.id),
    weekday = ((new Date(`${input.date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  const salonHours = scope.policy.staffHoursMode === "SALON_HOURS";
  const [hours, off, bookings, absent, branch] = await Promise.all([
    db.workingHours.findMany({
      where: {
        salonId: scope.salonId,
        branchId: input.branchId,
        staffId: { in: staffIds },
        dayOfWeek: weekday,
        active: true,
      },
      include: { breaks: true },
    }),
    db.timeOff.findMany({
      where: {
        salonId: scope.salonId,
        branchId: input.branchId,
        staffId: { in: staffIds },
        startsAt: { lt: window.end },
        endsAt: { gt: window.start },
      },
      select: { staffId: true, startsAt: true, endsAt: true },
    }),
    db.booking.findMany({
      where: {
        salonId: scope.salonId,
        staffId: { in: staffIds },
        status: { not: "CANCELLED" },
        startAt: { lt: window.end },
        endAt: { gt: window.start },
        ...(options.excludeId || options.excludeIds?.length
          ? {
              id: {
                notIn: [
                  ...(options.excludeId ? [options.excludeId] : []),
                  ...(options.excludeIds ?? []),
                ],
              },
            }
          : {}),
      },
      select: { staffId: true, startAt: true, endAt: true },
    }),
    // Staff marked «А» on the timesheet take no bookings that day.
    db.staffAttendance.findMany({
      where: {
        salonId: scope.salonId,
        staffId: { in: staffIds },
        date: new Date(`${input.date}T00:00:00Z`),
        status: "OFF",
      },
      select: { staffId: true },
    }),
    salonHours
      ? db.branch.findFirst({
          where: { id: input.branchId, salonId: scope.salonId },
          select: { openMinute: true, closeMinute: true },
        })
      : null,
  ]);
  const away = new Set(absent.map((a) => a.staffId));
  const result = new Map<string, string[]>();
  const grid = Array.from({ length: Math.ceil(1440 / interval) }, (_, i) =>
    minuteInstant(input.date, i * interval, zone),
  );
  for (const person of staff) {
    if (away.has(person.id)) continue;
    // In salon-hours mode everyone works the branch's opening hours, no breaks.
    const shifts = salonHours
      ? branch
        ? [
            {
              ...branch,
              startMinute: branch.openMinute,
              endMinute: branch.closeMinute,
              breaks: [],
            },
          ]
        : []
      : hours.filter((h) => h.staffId === person.id);
    const windows = shifts.map((h) => ({
      start: +minuteInstant(input.date, h.startMinute, zone),
      end: +minuteInstant(input.date, h.endMinute, zone),
    }));
    const blocked = [
      ...shifts.flatMap((h) =>
        h.breaks.map((b) => ({
          start: +minuteInstant(input.date, b.startMinute, zone),
          end: +minuteInstant(input.date, b.endMinute, zone),
        })),
      ),
      ...off
        .filter((o) => o.staffId === person.id)
        .map((o) => ({ start: +o.startsAt, end: +o.endsAt })),
      ...bookings
        .filter((b) => b.staffId === person.id)
        .map((b) => ({ start: +b.startAt, end: +b.endAt })),
    ];
    for (const start of grid) {
      const end = +start + duration * 60000;
      if (
        +start <= +now ||
        +start < earliest ||
        !fits(+start, end, windows, blocked)
      )
        continue;
      const key = start.toISOString();
      result.set(key, [...(result.get(key) ?? []), person.id]);
    }
  }
  return {
    service,
    staff,
    slots: [...result.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([startAt, staffIds]) => ({ startAt, staffIds })),
  };
}
export async function availability(
  db: Database,
  context: BookingContext,
  raw: unknown,
  clock: Clock = {},
) {
  const input = availabilitySchema.parse(raw),
    scope = await resolveContext(db, context);
  let current: Booking | null = null;
  if (input.durationMinutes && !scope.actor)
    throw new HttpError(403, "Энэ хүсэлтийг зөвшөөрөхгүй.");
  if (input.excludeBookingId) {
    if (!scope.actor) throw new HttpError(403, "Энэ хүсэлтийг зөвшөөрөхгүй.");
    current = await db.booking.findFirst({
      where: { ...bookingScope(scope.actor), id: input.excludeBookingId },
    });
    if (
      !current ||
      current.branchId !== input.branchId ||
      current.serviceId !== input.serviceId
    )
      throw new HttpError(404, "Захиалга олдсонгүй.");
    if (!["PENDING", "CONFIRMED"].includes(current.status))
      throw new HttpError(409, "Энэ захиалгын цагийг өөрчлөх боломжгүй.");
  }
  const result = await slots(db, scope, input, {
    excludeId: current?.id,
    duration: current?.durationMinutesSnapshot ?? input.durationMinutes,
    now: clock.now?.(),
  });
  return {
    slots: result.slots.map((s) => ({ startAt: s.startAt })),
    durationMinutes:
      current?.durationMinutesSnapshot ??
      input.durationMinutes ??
      result.service.durationMinutes,
  };
}
function retryable(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2034", "P2002"].includes(error.code)) ||
    (error instanceof Error && error.message.includes("Booking_no_overlap"))
  );
}
export async function transaction<T>(
  db: PrismaClient,
  work: (tx: Database) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (e) {
      if (!retryable(e)) throw e;
      if (attempt >= 3) throw new HttpError(409, bookingConflict);
    }
  }
}
export async function lockStaff(db: Database, ids: string[]) {
  for (const id of [...ids].sort())
    await db.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`booking-staff:${id}`},0))`;
}
export async function createBooking(
  db: PrismaClient,
  context: BookingContext,
  raw: unknown,
  clock: Clock = {},
) {
  const input = bookingSchema.parse(raw);
  return transaction(db, async (tx) => {
    const scope = await resolveContext(tx, context);
    if (scope.online && !scope.policy.publicBookingEnabled)
      throw new HttpError(403, publicBookingClosed);
    if (scope.actor) requireBranch(scope.actor, input.branchId);
    if (scope.online && input.durationMinutes)
      throw new HttpError(403, "Энэ хүсэлтийг зөвшөөрөхгүй.");
    if (scope.online && (input.customerId || input.notes))
      throw new HttpError(400, "Үйлчлүүлэгчийн нэр, утсаа оруулна уу.");
    const hash = createHash("sha256")
      .update(JSON.stringify({ input, principal: scope.actor?.id ?? "public" }))
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
      return existing;
    }
    const candidates = await resources(
      tx,
      scope,
      input.branchId,
      input.serviceId,
      input.staffId,
    );
    await lockStaff(
      tx,
      candidates.staff.map((s) => s.id),
    );
    const startAt = new Date(input.startAt),
      date = localStamp(startAt).slice(0, 10);
    const available = await slots(
      tx,
      scope,
      { ...input, date },
      { now: clock.now?.(), duration: input.durationMinutes },
    );
    const duration = input.durationMinutes ?? available.service.durationMinutes;
    const slot = available.slots.find(
      (s) => s.startAt === startAt.toISOString(),
    );
    if (!slot) throw new HttpError(409, bookingConflict);
    let customer;
    if (input.customerId) {
      customer = await tx.customer.findFirst({
        where: {
          id: input.customerId,
          salonId: scope.salonId,
          ...(scope.actor?.role === "SALON_OWNER"
            ? {}
            : { bookings: { some: bookingScope(scope.actor!) } }),
        },
      });
      if (!customer) throw new HttpError(404, "Үйлчлүүлэгч олдсонгүй.");
    } else {
      const data = input.customer!;
      if (scope.online)
        await assertGuestQuota(tx, scope.salonId, data.phone, 1);
      customer = await tx.customer.upsert({
        where: { salonId_phone: { salonId: scope.salonId, phone: data.phone } },
        create: {
          salonId: scope.salonId,
          name: data.name,
          phone: data.phone,
          email: data.email || null,
        },
        update: {},
      });
    }
    const price = discountedPrice(
      available.service.priceMnt,
      available.service.discountPercent,
    );
    const deposit = scope.online ? depositAmount(price, scope.policy) : 0;
    const booking = await tx.booking.create({
      data: {
        salonId: scope.salonId,
        branchId: input.branchId,
        serviceId: available.service.id,
        staffId: slot.staffIds[0],
        customerId: customer.id,
        startAt,
        endAt: new Date(+startAt + duration * 60000),
        // A required deposit keeps online bookings pending until staff verify it.
        status:
          scope.online &&
          (deposit > 0 ||
            scope.policy.bookingConfirmationMode === "MANUAL_CONFIRM")
            ? "PENDING"
            : "CONFIRMED",
        source: scope.online
          ? "ONLINE"
          : scope.actor!.role === "SALON_OWNER"
            ? "OWNER"
            : "RECEPTION",
        createdByMemberId: scope.actor?.id,
        serviceNameSnapshot: available.service.name,
        durationMinutesSnapshot: duration,
        priceSnapshot: price,
        discountPercentSnapshot: available.service.discountPercent,
        depositAmountSnapshot: deposit,
        customerNameSnapshot: input.customer?.name ?? customer.name,
        customerPhoneSnapshot: input.customer?.phone ?? customer.phone,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        requestHash: hash,
      },
    });
    if (scope.online) await recordActivity(tx, booking, "ONLINE_CREATED");
    await enqueueNotice(
      tx,
      [booking],
      booking.status === "CONFIRMED" ? "BOOKING_CONFIRMED" : "BOOKING_RECEIVED",
    );
    return booking;
  });
}
export async function changeBooking(
  db: PrismaClient,
  actor: Actor,
  id: string,
  raw: unknown,
) {
  const input = changeBookingSchema.parse(raw);
  return transaction(db, async (tx) => {
    const scope = await resolveContext(tx, { actor }),
      current = scope.actor!;
    const booking = await tx.booking.findFirst({
      where: { ...bookingScope(current), id },
    });
    if (!booking) throw new HttpError(404, "Захиалга олдсонгүй.");
    if (booking.version !== input.version)
      throw new HttpError(
        409,
        "Захиалга өөрчлөгдсөн байна. Хуудсаа шинэчилнэ үү.",
      );
    if (input.action === "status") {
      if (!transitions[booking.status].includes(input.status))
        throw new HttpError(409, "Захиалгын төлөвийг ингэж өөрчлөх боломжгүй.");
      const updated = await tx.booking.update({
        where: { id },
        data: { status: input.status, version: { increment: 1 } },
      });
      if (input.status === "CONFIRMED" || input.status === "CANCELLED")
        await enqueueNotice(
          tx,
          [updated],
          input.status === "CONFIRMED"
            ? "BOOKING_CONFIRMED"
            : "BOOKING_CANCELLED",
        );
      return updated;
    }
    if (!["PENDING", "CONFIRMED"].includes(booking.status))
      throw new HttpError(409, "Энэ захиалгын цагийг өөрчлөх боломжгүй.");
    const inputScope = {
      branchId: booking.branchId,
      serviceId: booking.serviceId,
      staffId: input.staffId ?? booking.staffId,
      date: localStamp(input.startAt).slice(0, 10),
    };
    await lockStaff(tx, [booking.staffId, inputScope.staffId]);
    const available = await slots(tx, scope, inputScope, {
      excludeId: booking.id,
      duration: booking.durationMinutesSnapshot,
    });
    const startAt = new Date(input.startAt),
      slot = available.slots.find((s) => s.startAt === startAt.toISOString());
    if (!slot) throw new HttpError(409, bookingConflict);
    const moved = await tx.booking.update({
      where: { id },
      data: {
        staffId: slot.staffIds[0],
        startAt,
        endAt: new Date(+startAt + booking.durationMinutesSnapshot * 60000),
        version: { increment: 1 },
      },
    });
    await enqueueNotice(tx, [moved], "BOOKING_RESCHEDULED");
    return moved;
  });
}
export function bookingView(
  b: Booking & { staff?: { name: string }; branch?: { name: string } },
) {
  return {
    id: b.id,
    branchId: b.branchId,
    staffId: b.staffId,
    serviceId: b.serviceId,
    customerId: b.customerId,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    source: b.source,
    serviceName: b.serviceNameSnapshot,
    customerName: b.customerNameSnapshot,
    customerPhone: b.customerPhoneSnapshot,
    priceMnt: b.priceSnapshot,
    depositMnt: b.depositAmountSnapshot,
    durationMinutes: b.durationMinutesSnapshot,
    notes: b.notes ?? "",
    version: b.version,
    staffName: b.staff?.name ?? "",
    branchName: b.branch?.name ?? "",
  };
}
export type BookingView = ReturnType<typeof bookingView>;
export async function readBooking(db: Database, actor: Actor, id: string) {
  const b = await db.booking.findFirst({
    where: { ...bookingScope(actor), id },
    include: {
      staff: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  if (!b) throw new HttpError(404, "Захиалга олдсонгүй.");
  return bookingView(b);
}
export async function listBookings(
  db: Database,
  actor: Actor,
  input: { date: string; days: number; branchId?: string; staffId?: string },
) {
  const start = dayWindow(input.date).start,
    end = dayWindow(addDays(input.date, input.days)).start;
  if (input.branchId) requireBranch(actor, input.branchId);
  await expireStalePending(
    db,
    actor.salonId,
    await salonBookingPolicy(db, actor.salonId),
  );
  const rows = await db.booking.findMany({
    where: {
      ...bookingScope(actor),
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.staffId ? { staffId: input.staffId } : {}),
      startAt: { lt: end },
      endAt: { gt: start },
    },
    include: {
      staff: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: [{ startAt: "asc" }, { id: "asc" }],
    take: 1001,
  });
  if (rows.length > 1000)
    throw new HttpError(
      400,
      "Хэт олон захиалга байна. Салбар, ажилтнаар шүүж эсвэл нэг өдөр сонгоно уу.",
    );
  return rows.map(bookingView);
}
export async function publicCatalog(db: Database, slug: string) {
  const scope = await resolveContext(db, { slug });
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: scope.salonId },
    select: {
      name: true,
      slug: true,
      coverUrl: true,
      logoUrl: true,
      description: true,
      phone: true,
      instagram: true,
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { url: true },
        take: 10,
      },
    },
  });
  if (!scope.policy.publicBookingEnabled)
    return {
      salon,
      policy: scope.policy,
      branches: [],
      categories: [],
      services: [],
      staff: [],
    };
  const [branches, categories, services, staff] = await Promise.all([
    db.branch.findMany({
      where: { salonId: scope.salonId, active: true },
      select: {
        id: true,
        name: true,
        address: true,
        district: true,
        phone: true,
        openMinute: true,
        closeMinute: true,
      },
      orderBy: { name: "asc" },
    }),
    db.serviceCategory.findMany({
      where: {
        salonId: scope.salonId,
        active: true,
        services: { some: { active: true, onlineBookable: true } },
      },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.service.findMany({
      where: {
        salonId: scope.salonId,
        active: true,
        onlineBookable: true,
        category: { active: true },
      },
      select: {
        id: true,
        name: true,
        description: true,
        categoryId: true,
        durationMinutes: true,
        priceMnt: true,
        discountPercent: true,
        branches: {
          where: { branch: { active: true } },
          select: { branchId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.staff.findMany({
      where: { salonId: scope.salonId, active: true },
      select: {
        id: true,
        name: true,
        title: true,
        branches: {
          where: { branch: { active: true } },
          select: { branchId: true },
        },
        services: {
          where: {
            service: {
              active: true,
              onlineBookable: true,
              category: { active: true },
            },
          },
          select: { serviceId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    salon,
    policy: scope.policy,
    branches,
    categories,
    services: services.map((s) => ({
      ...s,
      // priceMnt is what the guest pays; listPriceMnt shows the struck-out price.
      priceMnt: discountedPrice(s.priceMnt, s.discountPercent),
      listPriceMnt: s.priceMnt,
      branchIds: s.branches.map((b) => b.branchId),
    })),
    staff: staff.map((s) => ({
      ...s,
      branchIds: s.branches.map((b) => b.branchId),
      serviceIds: s.services.map((v) => v.serviceId),
    })),
  };
}
export type PublicCatalog = Awaited<ReturnType<typeof publicCatalog>>;
export async function publicReceipt(db: Database, b: Booking) {
  const [salon, branch, staff] = await Promise.all([
    db.salon.findUniqueOrThrow({
      where: { id: b.salonId },
      select: { name: true },
    }),
    db.branch.findUniqueOrThrow({
      where: { id: b.branchId },
      select: { name: true },
    }),
    db.staff.findUniqueOrThrow({
      where: { id: b.staffId },
      select: { name: true },
    }),
  ]);
  return {
    salonName: salon.name,
    branchName: branch.name,
    staffName: staff.name,
    serviceName: b.serviceNameSnapshot,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    priceMnt: b.priceSnapshot,
    status: b.status,
    deposit: b.depositAmountSnapshot ? await depositInstructions(db, b) : null,
  };
}
// Transfer details are shown only to the guest who just made the booking.
async function depositInstructions(db: Database, b: Booking) {
  const policy = await salonBookingPolicy(db, b.salonId);
  return {
    amountMnt: b.depositAmountSnapshot,
    bankName: policy.depositBankName,
    accountNumber: policy.depositAccountNumber,
    accountHolder: policy.depositAccountHolder,
    reference: b.customerPhoneSnapshot.replace(/^\+976/, ""),
  };
}
