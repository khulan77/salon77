import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "../errors";
import { type Actor, refreshActor, requireOwner } from "../access";
import { assertPlatformAdmin, monthStart, platformNotFound } from "./platform";
import { billingState, monthlyFee, nextPeriod } from "../billing";
import type { BylClient, RemoteCheckout } from "../payments/byl";
type Database = Prisma.TransactionClient;
export async function pricePerBranch(db: Database) {
  const row = await db.platformSetting.findUnique({
    where: { id: "default" },
    select: { pricePerBranchMnt: true },
  });
  return row?.pricePerBranchMnt ?? null;
}
export const priceInput = z
  .object({
    pricePerBranchMnt: z
      .number({ message: "Үнээ тоогоор оруулна уу." })
      .int("Үнээ бүхэл тоогоор оруулна уу.")
      .min(0, "Үнэ сөрөг байж болохгүй.")
      .max(10_000_000, "Үнэ хэт өндөр байна."),
  })
  .strict();
export async function setPricePerBranch(
  db: PrismaClient,
  adminUserId: string,
  raw: unknown,
) {
  const { pricePerBranchMnt } = priceInput.parse(raw);
  return db.$transaction(async (tx) => {
    await assertPlatformAdmin(tx, adminUserId);
    await tx.platformSetting.upsert({
      where: { id: "default" },
      create: { id: "default", pricePerBranchMnt },
      update: { pricePerBranchMnt },
    });
    return { pricePerBranchMnt };
  });
}
export const salonPriceInput = z
  .object({
    monthlyPriceMnt: z
      .number({ message: "Үнээ тоогоор оруулна уу." })
      .int("Үнээ бүхэл тоогоор оруулна уу.")
      .min(0, "Үнэ сөрөг байж болохгүй.")
      .max(100_000_000, "Үнэ хэт өндөр байна.")
      .nullable(),
  })
  .strict();
// The operator's own monthly fee for one salon; null returns it to the
// per-branch price.
export async function setSalonPrice(
  db: PrismaClient,
  adminUserId: string,
  salonId: string,
  raw: unknown,
) {
  const { monthlyPriceMnt } = salonPriceInput.parse(raw);
  return db.$transaction(async (tx) => {
    await assertPlatformAdmin(tx, adminUserId);
    const salon = await tx.salon.findUnique({
      where: { id: salonId },
      select: { id: true },
    });
    if (!salon) throw new HttpError(404, platformNotFound);
    await tx.salon.update({
      where: { id: salonId },
      data: { monthlyPriceMnt },
    });
    return { id: salonId, monthlyPriceMnt };
  });
}
export const paymentInput = z
  .object({ note: z.string().trim().max(200).default("") })
  .strict();
// The operator confirms a received monthly fee: the amount is computed here
// from the current price and active branches, never taken from the client.
export async function recordPayment(
  db: PrismaClient,
  adminUserId: string,
  salonId: string,
  raw: unknown,
  now = new Date(),
) {
  const { note } = paymentInput.parse(raw);
  return db.$transaction(
    async (tx) => {
      await assertPlatformAdmin(tx, adminUserId);
      const salon = await tx.salon.findUnique({
        where: { id: salonId },
        select: {
          reviewStatus: true,
          trialEndsAt: true,
          paidUntil: true,
          monthlyPriceMnt: true,
          _count: { select: { branches: { where: { active: true } } } },
        },
      });
      if (!salon) throw new HttpError(404, platformNotFound);
      if (salon.reviewStatus !== "APPROVED")
        throw new HttpError(409, "Эхлээд салоны хүсэлтийг зөвшөөрнө үү.");
      const branches = Math.max(1, salon._count.branches);
      const amountMnt = monthlyFee(
        salon.monthlyPriceMnt,
        await pricePerBranch(tx),
        branches,
      );
      if (amountMnt === null)
        throw new HttpError(
          409,
          "Эхлээд нэг салбарын сарын үнэ эсвэл энэ салоны үнийг тохируулна уу.",
        );
      const period = nextPeriod(salon, now);
      await tx.salonPayment.create({
        data: {
          salonId,
          amountMnt,
          branches,
          periodStart: period.start,
          periodEnd: period.end,
          note: note || null,
          recordedById: adminUserId,
        },
      });
      await tx.salon.update({
        where: { id: salonId },
        data: {
          paidUntil: period.end,
          renewalChoice: "CONTINUE",
          renewalChosenAt: now,
        },
      });
      return {
        amountMnt,
        branches,
        paidUntil: period.end.toISOString(),
      };
    },
    { isolationLevel: "Serializable" },
  );
}
// What a salon owes and how long it can use the system.
export async function salonBilling(
  db: Database,
  salonId: string,
  now = new Date(),
) {
  const [salon, price, payments, onlineMonth] = await Promise.all([
    db.salon.findUniqueOrThrow({
      where: { id: salonId },
      select: {
        name: true,
        reviewStatus: true,
        trialEndsAt: true,
        paidUntil: true,
        monthlyPriceMnt: true,
        renewalChoice: true,
        _count: {
          select: {
            branches: { where: { active: true } },
            services: { where: { active: true } },
            staff: { where: { active: true } },
          },
        },
      },
    }),
    pricePerBranch(db),
    db.salonPayment.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        amountMnt: true,
        branches: true,
        periodStart: true,
        periodEnd: true,
        note: true,
        createdAt: true,
      },
    }),
    db.booking.count({
      where: { salonId, source: "ONLINE", createdAt: { gte: monthStart(now) } },
    }),
  ]);
  const state = billingState(salon, now);
  const branches = Math.max(1, salon._count.branches);
  const trial = salon.trialEndsAt !== null && salon.paidUntil === null;
  return {
    name: salon.name,
    state: state.state,
    until: state.until?.toISOString() ?? null,
    daysLeft: state.daysLeft,
    warn: state.warn,
    trial,
    choice: salon.renewalChoice,
    // The owner is asked to continue or stop near and after the trial's end.
    askChoice:
      trial &&
      (state.state === "EXPIRED" || (state.state === "TRIAL" && state.warn)),
    // Where access would end if a payment were recorded now.
    nextEnd: nextPeriod(salon, now).end.toISOString(),
    branches,
    // What the operator looks at when setting a salon's own fee.
    usage: {
      branches: salon._count.branches,
      services: salon._count.services,
      staff: salon._count.staff,
      onlineMonth,
    },
    pricePerBranchMnt: price,
    // Set by hand for this salon, rather than per branch.
    customPrice: salon.monthlyPriceMnt !== null,
    amountMnt: monthlyFee(salon.monthlyPriceMnt, price, branches),
    payments: payments.map((p) => ({
      id: p.id,
      amountMnt: p.amountMnt,
      branches: p.branches,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      note: p.note ?? "",
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
export type SalonBilling = Awaited<ReturnType<typeof salonBilling>>;
// Where the platform's paying salons stand, for the console's top row.
export async function billingOverview(
  db: Database,
  adminUserId: string,
  now = new Date(),
) {
  await assertPlatformAdmin(db, adminUserId);
  // Start of this Ulaanbaatar calendar month.
  const month = monthStart(now);
  const [salons, price, received, thisMonth] = await Promise.all([
    db.salon.findMany({
      where: { reviewStatus: "APPROVED", status: "ACTIVE" },
      select: {
        reviewStatus: true,
        trialEndsAt: true,
        paidUntil: true,
        monthlyPriceMnt: true,
        _count: { select: { branches: { where: { active: true } } } },
      },
    }),
    pricePerBranch(db),
    db.salonPayment.aggregate({
      where: { createdAt: { gte: new Date(+now - 30 * 86400000) } },
      _sum: { amountMnt: true },
    }),
    db.salonPayment.aggregate({
      where: { createdAt: { gte: month } },
      _sum: { amountMnt: true },
      _count: { _all: true },
    }),
  ]);
  const counts = { TRIAL: 0, PAID: 0, EXPIRED: 0, due: 0 };
  let monthly: number | null = 0;
  for (const s of salons) {
    const b = billingState(s, now);
    if (b.state === "TRIAL" || b.state === "PAID") {
      counts[b.state]++;
      const fee = monthlyFee(s.monthlyPriceMnt, price, s._count.branches);
      monthly = fee === null || monthly === null ? null : monthly + fee;
    }
    if (b.state === "EXPIRED") counts.EXPIRED++;
    if (b.warn) counts.due++;
  }
  return {
    pricePerBranchMnt: price,
    trial: counts.TRIAL,
    paid: counts.PAID,
    due: counts.due,
    expired: counts.EXPIRED,
    received30Mnt: received._sum.amountMnt ?? 0,
    receivedMonthMnt: thisMonth._sum.amountMnt ?? 0,
    paymentsMonth: thisMonth._count._all,
    // What a month brings if every active salon keeps paying.
    monthlyMnt: monthly,
  };
}
export const renewalInput = z
  .object({ choice: z.enum(["CONTINUE", "STOP"]) })
  .strict();
// The owner says whether the salon goes on after the trial. Stopping keeps
// all data; the booking page closes when the free days run out.
export async function chooseRenewal(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
  now = new Date(),
) {
  const { choice } = renewalInput.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await refreshActor(tx, actor);
    requireOwner(current);
    const salon = await tx.salon.findUniqueOrThrow({
      where: { id: current.salonId },
      select: { reviewStatus: true, trialEndsAt: true, paidUntil: true },
    });
    const { state } = billingState(salon, now);
    if (state === "PENDING" || state === "FREE")
      throw new HttpError(409, "Танай салонд төлбөрийн сонголт шаардлагагүй.");
    await tx.salon.update({
      where: { id: current.salonId },
      data: { renewalChoice: choice, renewalChosenAt: now },
    });
    return { choice };
  });
}
// A payment page stays in use while it is open for the same amount, so a
// double click or a second visit does not open another one.
const REUSE_MS = 7 * 86400000;
// The owner opens a Byl page for the next 30 days. The amount is computed
// here, like an operator-recorded payment, and fixed on the checkout.
export async function openCheckout(
  db: PrismaClient,
  actor: Actor,
  byl: BylClient,
  now = new Date(),
) {
  const current = await refreshActor(db, actor);
  requireOwner(current);
  const salon = await db.salon.findUniqueOrThrow({
    where: { id: current.salonId },
    select: {
      name: true,
      slug: true,
      reviewStatus: true,
      trialEndsAt: true,
      paidUntil: true,
      monthlyPriceMnt: true,
      _count: { select: { branches: { where: { active: true } } } },
    },
  });
  const { state } = billingState(salon, now);
  if (state === "PENDING" || state === "FREE")
    throw new HttpError(409, "Танай салонд төлбөр шаардлагагүй байна.");
  const branches = Math.max(1, salon._count.branches);
  const amountMnt = monthlyFee(
    salon.monthlyPriceMnt,
    await pricePerBranch(db),
    branches,
  );
  if (!amountMnt)
    throw new HttpError(
      409,
      "Сарын төлбөрийн дүн хараахан тогтоогдоогүй байна.",
    );
  const open = await db.billingCheckout.findFirst({
    where: {
      salonId: current.salonId,
      status: "OPEN",
      amountMnt,
      createdAt: { gt: new Date(+now - REUSE_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  if (open) return { url: open.url };
  const base = process.env.APP_URL?.replace(/\/$/, "");
  const remote = await byl.create({
    amountMnt,
    name: `Salon77 · ${salon.name} · 30 хоног`,
    reference: salon.slug.slice(0, 48),
    successUrl: base && `${base}/billing?paid=1`,
    cancelUrl: base && `${base}/billing`,
  });
  await db.billingCheckout.create({
    data: {
      salonId: current.salonId,
      bylId: remote.id,
      url: remote.url,
      amountMnt,
      branches,
    },
  });
  return { url: remote.url };
}
// Applies Byl's view of one checkout. Safe to repeat: webhooks can arrive
// twice and the billing page asks again when the owner returns.
export async function settleCheckout(
  db: PrismaClient,
  remote: RemoteCheckout,
  now = new Date(),
) {
  return db.$transaction(
    async (tx) => {
      const row = await tx.billingCheckout.findUnique({
        where: { bylId: remote.id },
      });
      if (!row || row.status !== "OPEN") return row?.status ?? null;
      if (remote.status === "expired") {
        await tx.billingCheckout.update({
          where: { id: row.id },
          data: { status: "EXPIRED" },
        });
        return "EXPIRED";
      }
      if (remote.status !== "complete") return "OPEN";
      if (remote.amountTotal < row.amountMnt) {
        console.error("Byl checkout paid less than due", remote.id);
        return "OPEN";
      }
      const salon = await tx.salon.findUniqueOrThrow({
        where: { id: row.salonId },
        select: { reviewStatus: true, trialEndsAt: true, paidUntil: true },
      });
      const period = nextPeriod(salon, now);
      const payment = await tx.salonPayment.create({
        data: {
          salonId: row.salonId,
          amountMnt: row.amountMnt,
          branches: row.branches,
          periodStart: period.start,
          periodEnd: period.end,
          note: "Онлайн төлбөр (Byl)",
        },
      });
      await tx.billingCheckout.update({
        where: { id: row.id },
        data: { status: "PAID", paymentId: payment.id, paidAt: now },
      });
      await tx.salon.update({
        where: { id: row.salonId },
        data: {
          paidUntil: period.end,
          renewalChoice: "CONTINUE",
          renewalChosenAt: now,
        },
      });
      return "PAID";
    },
    { isolationLevel: "Serializable" },
  );
}
// The owner can land back on /billing before Byl's webhook does; this asks
// Byl about the salon's latest open pages directly.
export async function checkOpenCheckouts(
  db: PrismaClient,
  salonId: string,
  byl: BylClient,
  now = new Date(),
) {
  const open = await db.billingCheckout.findMany({
    where: { salonId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { bylId: true },
  });
  for (const { bylId } of open) {
    const remote = await byl.get(bylId).catch(() => null);
    if (remote) await settleCheckout(db, remote, now);
  }
}
