import { test } from "node:test";
import assert from "node:assert/strict";
import {
  branchSchema,
  inviteSchema,
  onboardingSchema,
} from "../lib/validation";
import {
  formatMongolianDate,
  roleLabel,
  userFacingError,
  validationMessage,
} from "../lib/ui-language";

test("role labels are Mongolian without changing internal role values", () => {
  assert.equal(roleLabel("SALON_OWNER"), "Эзэмшигч");
  assert.equal(roleLabel("MANAGER"), "Менежер");
  assert.equal(roleLabel("RECEPTIONIST"), "Ресепшн");
  assert.equal(roleLabel("STAFF"), "Ажилтан");
  assert.equal(roleLabel("SUPER_ADMIN"), "Системийн админ");
  assert.equal(roleLabel("UNKNOWN"), "Тодорхойгүй эрх");
});

test("validation displays Mongolian for missing, malformed, injected and out-of-range input", () => {
  const results = [
    branchSchema.safeParse({}),
    branchSchema.safeParse({
      name: "",
      district: "Дүүрэг",
      address: "Хаяг",
      phone: "1",
      latitude: 91,
      longitude: -181,
      active: "yes",
      salonId: "injected",
    }),
    onboardingSchema.safeParse({
      name: "Салон",
      phone: "1",
      instagram: "x".repeat(101),
      description: "x".repeat(1001),
      slug: "bad slug",
      branch: {},
    }),
    onboardingSchema.shape.slug.safeParse("api"),
    onboardingSchema.shape.slug.safeParse("ab"),
    inviteSchema.safeParse({
      name: "Нэр",
      email: "bad",
      role: "SALON_OWNER",
      branchIds: [],
    }),
    inviteSchema.safeParse({
      name: "Нэр",
      email: "a@example.com",
      role: "STAFF",
      branchIds: Array(101).fill("branch"),
    }),
  ];
  for (const result of results) {
    assert.equal(result.success, false);
    if (!result.success)
      for (const issue of result.error.issues) {
        const message = validationMessage(issue);
        assert.match(message, /[А-Яа-яӨөҮү]/);
        assert.doesNotMatch(message, /[a-zA-Z]/);
      }
  }
});

test("native network and JSON errors never leak English into UI", () => {
  const fallback = "Холболтоо шалгаад дахин оролдоно уу.";
  assert.equal(
    userFacingError(new TypeError("Failed to fetch"), fallback),
    fallback,
  );
  assert.equal(
    userFacingError(new SyntaxError("Unexpected token"), fallback),
    fallback,
  );
  assert.equal(
    userFacingError(new Error("Салбар олдсонгүй."), fallback),
    "Салбар олдсонгүй.",
  );
});

test("Mongolian dates use Ulaanbaatar day boundaries without browser locale fallback", () => {
  assert.equal(
    formatMongolianDate(new Date("2026-10-04T15:59:00Z")),
    "2026 оны 10-р сарын 4, Ням",
  );
  assert.equal(
    formatMongolianDate(new Date("2026-10-04T16:00:00Z")),
    "2026 оны 10-р сарын 5, Даваа",
  );
});
test("relative login times read naturally in Mongolian", async () => {
  const { formatTimeAgo } = await import("../lib/ui-language");
  const now = new Date("2026-10-09T12:00:00Z");
  const ago = (minutes: number) =>
    formatTimeAgo(new Date(+now - minutes * 60000).toISOString(), now);
  assert.equal(ago(0), "дөнгөж сая");
  assert.equal(ago(15), "15 минутын өмнө");
  assert.equal(ago(180), "3 цагийн өмнө");
  assert.equal(ago(60 * 30), "өчигдөр");
  assert.equal(ago(60 * 24 * 5), "5 өдрийн өмнө");
  assert.match(ago(60 * 24 * 40), /^2026 оны 8-р сарын 30/);
});
test("service templates and their validation read in Mongolian", async () => {
  const { SERVICE_TEMPLATES } = await import("../lib/service-templates");
  const { serviceTemplatesSchema } = await import("../lib/validation");
  for (const t of SERVICE_TEMPLATES) {
    assert.match(t.name, /^[А-Яа-яЁёӨөҮү ,]+$/);
    assert.match(t.category, /^[А-Яа-яЁёӨөҮү ]+$/);
  }
  const empty = serviceTemplatesSchema.safeParse({ items: [] });
  assert.equal(empty.success, false);
  assert.equal(
    empty.error?.issues[0].message,
    "Дор хаяж нэг үйлчилгээ сонгоно уу.",
  );
});
test("branch districts come from one Mongolian list", async () => {
  const { DISTRICTS, normalizeDistrict } = await import("../lib/districts");
  assert.equal(DISTRICTS.length, 9);
  for (const d of DISTRICTS) {
    assert.match(d, /^[А-Яа-яӨөҮү-]+$/);
    assert.equal(normalizeDistrict(d), d);
  }
  assert.equal(normalizeDistrict("СБД"), "Сүхбаатар");
  assert.equal(normalizeDistrict(" сүхбаатар дүүрэг "), "Сүхбаатар");
  assert.equal(normalizeDistrict("Хан Уул"), "Хан-Уул");
  assert.equal(normalizeDistrict("Khan-Uul"), "Хан-Уул");
  assert.equal(normalizeDistrict("Дархан"), null);
  const branch = { name: "Үндсэн салбар", address: "Хаяг", phone: "99112233" };
  const parsed = branchSchema.safeParse({ ...branch, district: "БЗД" });
  assert.equal(parsed.success && parsed.data.district, "Баянзүрх");
  const unknown = branchSchema.safeParse({ ...branch, district: "Дархан" });
  assert.equal(unknown.success, false);
  assert.equal(
    unknown.error?.issues[0].message,
    "Дүүргээ жагсаалтаас сонгоно уу.",
  );
});
