import { z } from "zod";
export const bookingSettingsSchema = z
  .object({
    publicBookingEnabled: z.boolean(),
    bookingConfirmationMode: z.enum(["AUTO_CONFIRM", "MANUAL_CONFIRM"]),
    advanceBookingDays: z.number().int().min(0).max(365),
    minimumBookingNoticeMinutes: z.number().int().min(0).max(525600),
    cancellationNoticeMinutes: z.number().int().min(0).max(525600),
    slotIntervalMinutes: z.union([z.literal(15), z.literal(30)]),
  })
  .strict();
export type BookingPolicy = z.infer<typeof bookingSettingsSchema>;
export const defaultBookingSettings: BookingPolicy = {
  publicBookingEnabled: true,
  bookingConfirmationMode: "MANUAL_CONFIRM",
  advanceBookingDays: 365,
  minimumBookingNoticeMinutes: 0,
  cancellationNoticeMinutes: 0,
  slotIntervalMinutes: 15,
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
  };
}
