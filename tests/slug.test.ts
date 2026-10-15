import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../lib/slug";
test("salon names become web addresses", () => {
  assert.equal(slugify("Гоо Нэйлс"), "goo-neils");
  assert.equal(slugify("Үзэсгэлэн 77"), "uzesgelen-77");
  assert.equal(slugify("Cloud Nail"), "cloud-nail");
  assert.equal(slugify("cloud-nail"), "cloud-nail");
  assert.equal(slugify("!!! — ???"), "");
  assert.equal(slugify(""), "");
});
test("slugs are trimmed to 63 characters without a trailing dash", () => {
  assert.equal(slugify("а".repeat(80)), "a".repeat(63));
  const cut = slugify(`${"б".repeat(62)} в`);
  assert.equal(cut, "b".repeat(62));
  assert.ok(!slugify("Хос  -- зураас  ").includes("--"));
  assert.equal(slugify("  -Хос-  "), "khos");
});
