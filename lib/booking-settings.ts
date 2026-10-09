import { z } from "zod";
const bankText = z.string().trim().max(100);
export const bookingSettingsSchema = z
  .object({
    publicBookingEnabled: z.boolean(),
    bookingConfirmationMode: z.enum(["AUTO_CONFIRM", "MANUAL_CONFIRM"]),
    advanceBookingDays: z.number().int().min(0).max(365),
    minimumBookingNoticeMinutes: z.number().int().min(0).max(525600),
    cancellationNoticeMinutes: z.number().int().min(0).max(525600),
    slotIntervalMinutes: z.union([z.literal(15), z.literal(30)]),
    depositRequired: z.boolean(),
    depositType: z.enum(["PERCENT", "FIXED"]),
    depositValue: z.number().int().min(1).max(1000000000),
    depositBankName: bankText,
    depositAccountNumber: bankText,
    depositAccountHolder: bankText,
    staffHoursMode: z.enum(["CUSTOM", "SALON_HOURS"]),
    pendingExpiryMinutes: z.number().int().min(0).max(10080),
    notificationsEnabled: z.boolean(),
    listedInDirectory: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.depositType === "PERCENT" && v.depositValue > 100)
      ctx.addIssue({
        code: "custom",
        path: ["depositValue"],
        message: "Урьдчилгааны хувь 1–100 хооронд байна.",
      });
    if (
      v.depositRequired &&
      (!v.depositBankName || !v.depositAccountNumber || !v.depositAccountHolder)
    )
      ctx.addIssue({
        code: "custom",
        path: ["depositBankName"],
        message:
          "Урьдчилгаа авахын тулд банк, данс, эзэмшигчийн нэрийг бөглөнө үү.",
      });
  });
export type BookingPolicy = z.infer<typeof bookingSettingsSchema>;
export const defaultBookingSettings: BookingPolicy = {
  publicBookingEnabled: true,
  bookingConfirmationMode: "MANUAL_CONFIRM",
  advanceBookingDays: 365,
  minimumBookingNoticeMinutes: 0,
  cancellationNoticeMinutes: 0,
  slotIntervalMinutes: 15,
  depositRequired: false,
  depositType: "PERCENT",
  depositValue: 30,
  depositBankName: "",
  depositAccountNumber: "",
  depositAccountHolder: "",
  staffHoursMode: "CUSTOM",
  pendingExpiryMinutes: 0,
  notificationsEnabled: false,
  listedInDirectory: true,
};
export const publicBookingClosed = "Онлайн захиалга одоогоор хаалттай байна.";
export function policyView(value: BookingPolicy): BookingPolicy {
  return {
    publicBookingEnabled: value.publicBookingEnabled,
    bookingConfirmationMode: value.bookingConfirmationMode,
    advanceBookingDays: value.advanceBookingDays,
    minimumBookingNoticeMinutes: value.minimumBookingNoticeMinutes,
    cancellationNoticeMinutes: value.cancellationNoticeMinutes,
    slotIntervalMinutes: value.slotIntervalMinutes,
    depositRequired: value.depositRequired,
    depositType: value.depositType,
    depositValue: value.depositValue,
    depositBankName: value.depositBankName,
    depositAccountNumber: value.depositAccountNumber,
    depositAccountHolder: value.depositAccountHolder,
    staffHoursMode: value.staffHoursMode,
    pendingExpiryMinutes: value.pendingExpiryMinutes,
    notificationsEnabled: value.notificationsEnabled,
    listedInDirectory: value.listedInDirectory,
  };
}
// Deposits apply to online bookings only; reception collects payment in person.
export function depositAmount(
  priceMnt: number,
  policy: Pick<
    BookingPolicy,
    "depositRequired" | "depositType" | "depositValue"
  >,
) {
  if (!policy.depositRequired || priceMnt <= 0) return 0;
  const amount =
    policy.depositType === "FIXED"
      ? policy.depositValue
      : Math.round((priceMnt * policy.depositValue) / 10000) * 100;
  return Math.min(priceMnt, Math.max(0, amount));
}
