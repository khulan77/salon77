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
test("deposit policy validation and amounts", async () => {
  const { depositAmount } = await import("../lib/booking-settings");
  const bank = {
    depositBankName: "Хаан банк",
    depositAccountNumber: "5000123456",
    depositAccountHolder: "Салон ХХК",
  };
  const ok = { ...defaultBookingSettings, depositRequired: true, ...bank };
  assert.ok(bookingSettingsSchema.safeParse(ok).success);
  for (const bad of [
    { ...ok, depositBankName: "" },
    { ...ok, depositValue: 101 },
    { ...ok, depositValue: 0 },
    { ...ok, depositType: "CASH" },
  ])
    assert.equal(bookingSettingsSchema.safeParse(bad).success, false);
  // Bank details are optional while deposits are off.
  assert.ok(
    bookingSettingsSchema.safeParse({
      ...defaultBookingSettings,
      depositRequired: false,
    }).success,
  );
  assert.equal(depositAmount(65000, ok), 19500);
  assert.equal(depositAmount(55000, { ...ok, depositValue: 15 }), 8300);
  assert.equal(
    depositAmount(65000, { ...ok, depositType: "FIXED", depositValue: 20000 }),
    20000,
  );
  assert.equal(
    depositAmount(15000, { ...ok, depositType: "FIXED", depositValue: 20000 }),
    15000,
  );
  assert.equal(depositAmount(65000, { ...ok, depositRequired: false }), 0);
});
test("cover uploads are recognised by their bytes, not their name", async () => {
  const { imageType } = await import("../lib/services/salon-media");
  assert.equal(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext, "jpg");
  assert.equal(
    imageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ?.ext,
    "png",
  );
  assert.equal(
    imageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.ext,
    "webp",
  );
  assert.equal(
    imageType(new TextEncoder().encode("<svg onload=alert(1)>")),
    null,
  );
  assert.equal(imageType(new TextEncoder().encode("GIF89a")), null);
});
