import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingSettingsSchema,
  defaultBookingSettings,
} from "../lib/booking-settings";
test("booking policy validation bounds, enums and tenant injection", () => {
  assert.ok(bookingSettingsSchema.safeParse(defaultBookingSettings).success);
  for (const extra of [
    { salonId: "foreign" },
    { advanceBookingDays: -1 },
    { advanceBookingDays: 366 },
    { advanceBookingDays: 1.5 },
    { minimumBookingNoticeMinutes: -1 },
    { cancellationNoticeMinutes: -1 },
    { slotIntervalMinutes: 20 },
    { publicBookingEnabled: "true" },
    { bookingConfirmationMode: "CONFIRMED" },
  ])
    assert.equal(
      bookingSettingsSchema.safeParse({ ...defaultBookingSettings, ...extra })
        .success,
      false,
    );
  assert.ok(
    bookingSettingsSchema.safeParse({
      ...defaultBookingSettings,
      advanceBookingDays: 0,
      slotIntervalMinutes: 30,
    }).success,
  );
});
