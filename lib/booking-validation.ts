import { z } from "zod";
export function normalizePhone(raw: string) {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  const digits = compact.startsWith("00") ? "+" + compact.slice(2) : compact;
  if (/^\d{8}$/.test(digits)) return "+976" + digits;
  if (/^976\d{8}$/.test(digits)) return "+" + digits;
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  throw new Error(
    "Утасны дугаараа шалгана уу. Гадаад дугаарыг улсын кодтой оруулна уу.",
  );
}
const id = z.string().min(1).max(100);
// Staff may stretch or shorten an appointment; online guests always get the service length.
const durationOverride = z.coerce
  .number({ error: "Үргэлжлэх хугацааг зөв сонгоно уу." })
  .int()
  .min(5, "Үргэлжлэх хугацаа хамгийн багадаа 5 минут.")
  .max(720, "Үргэлжлэх хугацаа 12 цагаас ихгүй байна.");
export const dateSchema = z.iso.date("Өдрөө зөв сонгоно уу.");
export const customerInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    phone: z
      .string()
      .max(40)
      .transform((value, ctx) => {
        try {
          return normalizePhone(value);
        } catch {
          ctx.addIssue({
            code: "custom",
            message:
              "Утасны дугаараа шалгана уу. Гадаад дугаарыг улсын кодтой оруулна уу.",
          });
          return z.NEVER;
        }
      }),
    email: z.union([z.email(), z.literal("")]).optional(),
  })
  .strict();
export const availabilitySchema = z
  .object({
    branchId: id,
    serviceId: id,
    date: dateSchema,
    staffId: id.optional(),
    excludeBookingId: id.optional(),
    durationMinutes: durationOverride.optional(),
  })
  .strict();
export const bookingSchema = z
  .object({
    branchId: id,
    serviceId: id,
    staffId: id.optional(),
    startAt: z.iso.datetime({ offset: true }),
    customerId: id.optional(),
    customer: customerInput.optional(),
    durationMinutes: durationOverride.optional(),
    notes: z.string().trim().max(2000).default(""),
    idempotencyKey: z.uuid(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.customerId) !== Boolean(v.customer),
    "Үйлчлүүлэгч сонгох эсвэл шинэ үйлчлүүлэгчийн мэдээлэл оруулна уу.",
  );
export const changeBookingSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("status"),
      status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
      version: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal("reschedule"),
      staffId: id.optional(),
      startAt: z.iso.datetime({ offset: true }),
      version: z.number().int().positive(),
    })
    .strict(),
]);
export const statusLabels: Record<string, string> = {
  PENDING: "Хүлээгдэж буй",
  CONFIRMED: "Баталгаажсан",
  COMPLETED: "Дууссан",
  CANCELLED: "Цуцалсан",
  NO_SHOW: "Ирээгүй",
};
export const sourceLabels: Record<string, string> = {
  ONLINE: "Цахим",
  RECEPTION: "Ресепшн",
  OWNER: "Эзэмшигч",
};
export const transitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};
