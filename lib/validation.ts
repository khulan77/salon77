import { localStamp } from "./business-time";
import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const branchSchema = z
  .object({
    name: text(100),
    district: text(100),
    address: text(500),
    phone: text(30),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    openMinute: z.number().int().min(0).max(1440).optional(),
    closeMinute: z.number().int().min(0).max(1440).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.openMinute === undefined ||
      v.closeMinute === undefined ||
      v.closeMinute > v.openMinute,
    "Хаах цаг нээх цагаас хойш байх ёстой.",
  );
const reserved = [
  "api",
  "invite",
  "auth",
  "sign-in",
  "sign-up",
  "onboarding",
  "dashboard",
  "branches",
  "team",
  "settings",
  "calendar",
  "bookings",
  "customers",
  "reviews",
  "services",
  "packages",
  "promotions",
  "inventory",
  "sales",
  "employees",
  "schedules",
  "salon-page",
  "gallery",
  "reports",
  "plan",
  "partnership",
  "support",
];
export const onboardingSchema = z.object({
  name: text(100),
  phone: text(30),
  instagram: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .refine(
      (s) => !reserved.includes(s),
      "Энэ хаягийг системд ашигладаг тул өөр хаяг сонгоно уу.",
    ),
  branch: branchSchema,
});
export const inviteSchema = z
  .object({
    name: text(100),
    email: z.email().transform((s) => s.toLowerCase()),
    role: z.enum(["MANAGER", "RECEPTIONIST", "STAFF"]),
    branchIds: z.array(z.string().min(1)).min(1).max(100),
  })
  .strict();

export const memberSchema = z
  .object({
    role: z.enum(["MANAGER", "RECEPTIONIST", "STAFF"]),
    branchIds: z.array(z.string().min(1)).min(1).max(100),
    active: z.boolean(),
  })
  .strict();
export const tokenSchema = z
  .string()
  .regex(
    /^[a-f0-9]{64}$/,
    "Энэ урилга хүчингүй эсвэл хугацаа нь дууссан байна.",
  );

const ids = z
  .array(z.string().min(1).max(100))
  .min(1)
  .max(100)
  .transform((v) => [...new Set(v)]);
export const categorySchema = z
  .object({
    name: text(100),
    sortOrder: z.number().int().min(0).max(10000),
    active: z.boolean(),
  })
  .strict();
export const serviceSchema = z
  .object({
    name: text(150),
    description: z.string().trim().max(2000),
    categoryId: z.string().min(1).max(100),
    priceMnt: z
      .number()
      .int("Үнийг бүхэл төгрөгөөр оруулна уу.")
      .min(0)
      .max(1000000000),
    durationMinutes: z.number().int().min(1).max(1440),
    discountPercent: z
      .number()
      .int("Хямдралын хувийг бүхэл тоогоор оруулна уу.")
      .min(0)
      .max(90, "Хямдрал 90%-иас ихгүй байна.")
      .default(0),
    onlineBookable: z.boolean(),
    active: z.boolean(),
    branchIds: ids,
  })
  .strict();

const weeklyShift = z
  .object({
    branchId: z.string().min(1).max(100),
    days: z
      .array(z.number().int().min(1).max(7))
      .max(7)
      .transform((v) => [...new Set(v)]),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
  })
  .strict()
  .refine(
    (v) => v.endMinute > v.startMinute,
    "Ажлын цагийн эхлэх болон дуусах цагийг шалгана уу.",
  );
export const staffSchema = z
  .object({
    name: text(100),
    title: z.string().trim().max(100).default(""),
    phone: z.string().trim().max(30),
    bio: z.string().trim().max(2000),
    active: z.boolean(),
    memberId: z.string().min(1).max(100).nullable(),
    branchIds: ids,
    serviceIds: z
      .array(z.string().min(1).max(100))
      .max(200)
      .transform((v) => [...new Set(v)]),
    // Weekly shift per branch; replaces that branch's hours when sent.
    schedule: z.array(weeklyShift).max(100).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const s of v.schedule ?? [])
      if (!v.branchIds.includes(s.branchId))
        ctx.addIssue({
          code: "custom",
          message: "Хуваарийн салбарыг ажилтны салбаруудаас сонгоно уу.",
        });
  });
const minute = z.number().int().min(0).max(1440);
export const breakSchema = z
  .object({ startMinute: minute, endMinute: minute })
  .strict()
  .refine(
    (v) => v.endMinute > v.startMinute,
    "Эхлэх болон дуусах цагийг шалгана уу.",
  );
export const hoursSchema = z
  .object({
    staffId: text(100),
    branchId: text(100),
    dayOfWeek: z.number().int().min(1).max(7),
    startMinute: minute,
    endMinute: minute,
    active: z.boolean(),
    breaks: z.array(breakSchema).max(20),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.endMinute <= v.startMinute)
      ctx.addIssue({
        code: "custom",
        message: "Эхлэх болон дуусах цагийг шалгана уу.",
      });
    const sorted = [...v.breaks].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (
        !v.active ||
        b.startMinute < v.startMinute ||
        b.endMinute > v.endMinute
      )
        ctx.addIssue({
          code: "custom",
          message: "Завсарлага ажлын цагийн дотор байх ёстой.",
        });
      if (i && sorted[i - 1].endMinute > b.startMinute)
        ctx.addIssue({
          code: "custom",
          message: "Завсарлагын цаг давхцаж байна.",
        });
    }
  });
const dateTime = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
export const timeOffSchema = z
  .object({
    staffId: text(100),
    branchId: text(100),
    startsAt: dateTime,
    endsAt: dateTime,
    fullDay: z.boolean(),
    reason: z.string().trim().max(500),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.endsAt <= v.startsAt)
      ctx.addIssue({
        code: "custom",
        message: "Чөлөө дуусах хугацаа эхлэх хугацаанаас хойш байх ёстой.",
      });
    if (
      v.fullDay &&
      [v.startsAt, v.endsAt].some(
        (d) =>
          !localStamp(d).endsWith("T00:00") ||
          d.getUTCSeconds() !== 0 ||
          d.getUTCMilliseconds() !== 0,
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Бүтэн өдрийн чөлөө Улаанбаатарын цагаар шөнө дундаас эхэлж, шөнө дунд дуусна.",
      });
  });
