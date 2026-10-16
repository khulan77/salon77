import test from "node:test";
import assert from "node:assert/strict";
import { bookingThemes, recommendedBookingTheme } from "../lib/booking-themes";
function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((v) => {
      const n = parseInt(v, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
for (const [name, p] of Object.entries(bookingThemes)) {
  test(`${name} text and controls meet AA contrast`, () => {
    for (const bg of [p.background, p.surface, p.soft]) {
      for (const fg of [p.foreground, p.muted, p.accent])
        assert.ok(
          contrast(fg, bg) >= 4.5,
          `${name} ${fg}/${bg}: ${contrast(fg, bg)}`,
        );
    }
    assert.ok(contrast(p.accent, p.onAccent) >= 4.5);
    for (const bg of [p.background, p.surface])
      assert.ok(contrast(p.border, bg) >= 3);
    assert.match(p.label, /^[А-Яа-яӨөҮүЁё ]+$/u);
  });
}
test("service recommendations have deterministic priority and a light fallback", () => {
  assert.equal(recommendedBookingTheme(["HAIR", "NAILS"]), "DARK");
  assert.equal(recommendedBookingTheme(["LASHES"]), "PINK");
  assert.equal(recommendedBookingTheme(["SKIN"]), "NATURAL");
  assert.equal(recommendedBookingTheme(["MASSAGE"]), "NATURAL");
  assert.equal(recommendedBookingTheme(["OTHER"]), "LIGHT");
  assert.equal(recommendedBookingTheme([]), "LIGHT");
});
