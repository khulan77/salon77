import test from "node:test";
import assert from "node:assert/strict";
import { discountedPrice } from "../lib/pricing";
import { serviceSchema } from "../lib/validation";
test("discounted prices round to the nearest 100₮", () => {
  assert.equal(discountedPrice(70000, 0), 70000);
  assert.equal(discountedPrice(70000, 10), 63000);
  assert.equal(discountedPrice(65000, 10), 58500);
  assert.equal(discountedPrice(55000, 15), 46800); // 46,750 → 46,800
  assert.equal(discountedPrice(12345, 0), 12345);
  assert.equal(discountedPrice(0, 50), 0);
});
test("service discount validation bounds", () => {
  const base = {
    name: "Маникюр",
    description: "",
    categoryId: "c",
    priceMnt: 50000,
    durationMinutes: 60,
    onlineBookable: true,
    active: true,
    branchIds: ["z"],
  };
  assert.equal(serviceSchema.parse(base).discountPercent, 0);
  assert.equal(
    serviceSchema.parse({ ...base, discountPercent: 90 }).discountPercent,
    90,
  );
  for (const discountPercent of [-1, 91, 12.5, "10"])
    assert.equal(
      serviceSchema.safeParse({ ...base, discountPercent }).success,
      false,
    );
});
