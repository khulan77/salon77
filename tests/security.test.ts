import { test } from "node:test";
import assert from "node:assert/strict";
import { permits, type Membership } from "../lib/permissions";
import {
  branchSchema,
  inviteSchema,
  onboardingSchema,
} from "../lib/validation";
const owner: Membership = {
  salonId: "salon-a",
  active: true,
  role: "SALON_OWNER",
  branches: [],
};
test("owner can manage their own salon", () =>
  assert.equal(permits(owner, "salon-a", "manage"), true));
test("Salon A owner cannot read Salon B or its branches", () => {
  assert.equal(permits(owner, "salon-b", "read"), false);
  assert.equal(permits(owner, "salon-b", "read", "branch-b"), false);
});
test("Salon A owner cannot update or deactivate Salon B", () =>
  assert.equal(permits(owner, "salon-b", "manage", "branch-b"), false));
test("missing and inactive membership fail closed", () => {
  assert.equal(permits(null, "salon-a", "manage"), false);
  assert.equal(
    permits({ ...owner, active: false }, "salon-a", "manage"),
    false,
  );
});
for (const role of ["MANAGER", "RECEPTIONIST", "STAFF"]) {
  test(`${role} cannot access owner operations or unassigned branches`, () => {
    const member = { ...owner, role, branches: [{ branchId: "branch-a" }] };
    assert.equal(permits(member, "salon-a", "manage"), false);
    assert.equal(permits(member, "salon-a", "read", "branch-b"), false);
    assert.equal(permits(member, "salon-b", "read", "branch-a"), false);
    assert.equal(permits(member, "salon-a", "read", "branch-a"), true);
  });
}
const branch = {
  name: "Zaisan",
  district: "Khan-Uul",
  address: "Street 1",
  phone: "99112233",
};
test("client cannot inject salon membership, tenant IDs, or branch ownership", () => {
  assert.equal(
    branchSchema.safeParse({ ...branch, salonId: "salon-b" }).success,
    false,
  );
  assert.equal(
    branchSchema.safeParse({ ...branch, id: "branch-b" }).success,
    false,
  );
  assert.equal(
    inviteSchema.safeParse({
      name: "Person",
      email: "a@example.com",
      role: "SALON_OWNER",
      branchIds: ["b"],
    }).success,
    false,
  );
  assert.equal(
    inviteSchema.safeParse({
      name: "Person",
      email: "a@example.com",
      role: "MANAGER",
      branchIds: ["b"],
      salonId: "salon-b",
    }).success,
    false,
  );
});
test("invalid coordinates and empty required fields are rejected", () => {
  assert.equal(
    branchSchema.safeParse({ ...branch, latitude: 91 }).success,
    false,
  );
  assert.equal(
    branchSchema.safeParse({ ...branch, longitude: -181 }).success,
    false,
  );
  assert.equal(
    branchSchema.safeParse({ ...branch, name: "  " }).success,
    false,
  );
});
test("reserved and malformed public slugs are rejected", () => {
  for (const slug of [
    "api",
    "sign-in",
    "../salon",
    "Cloud Nail",
    "cloud--nail",
  ])
    assert.equal(onboardingSchema.shape.slug.safeParse(slug).success, false);
  assert.equal(
    onboardingSchema.shape.slug.safeParse("cloud-nail").success,
    true,
  );
});
test("invitation requires at least one assigned branch and a real email shape", () => {
  assert.equal(
    inviteSchema.safeParse({
      name: "A",
      email: "a@example.com",
      role: "MANAGER",
      branchIds: [],
    }).success,
    false,
  );
  assert.equal(
    inviteSchema.safeParse({
      name: "A",
      email: "not-email",
      role: "STAFF",
      branchIds: ["a"],
    }).success,
    false,
  );
});

test("unknown roles fail closed even with a branch assignment", () => {
  assert.equal(
    permits(
      { ...owner, role: "UNKNOWN", branches: [{ branchId: "branch-a" }] },
      "salon-a",
      "read",
      "branch-a",
    ),
    false,
  );
});
