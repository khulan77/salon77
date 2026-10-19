import { test } from "node:test";
import assert from "node:assert/strict";
import {
  platformEmailAllowed,
  platformMfaFresh,
} from "../lib/platform-access";
const now = Date.UTC(2026, 9, 19, 12);
const totp = (hoursAgo: number) => [
  { method: "password", timestamp: now / 1000 - hoursAgo * 3600 },
  { method: "totp", timestamp: now / 1000 - hoursAgo * 3600 },
];
test("only listed emails reach the platform console", () => {
  const env = { PLATFORM_ADMIN_EMAILS: " Me@Salon77.mn , ops@x.mn" };
  assert.equal(platformEmailAllowed("me@salon77.mn", env), true);
  assert.equal(platformEmailAllowed("OPS@x.mn", env), true);
  assert.equal(platformEmailAllowed("owner@x.mn", env), false);
});
test("production lets nobody in while the list is unset", () => {
  assert.equal(
    platformEmailAllowed("me@salon77.mn", { NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    platformEmailAllowed("me@salon77.mn", {
      NODE_ENV: "production",
      PLATFORM_ADMIN_EMAILS: " , ",
    }),
    false,
  );
  assert.equal(
    platformEmailAllowed("me@salon77.mn", { NODE_ENV: "development" }),
    true,
  );
});
test("the console needs a recent authenticator code", () => {
  assert.equal(platformMfaFresh({ aal: "aal2", amr: totp(1) }, now), true);
  assert.equal(platformMfaFresh({ aal: "aal2", amr: totp(13) }, now), false);
  assert.equal(platformMfaFresh({ aal: "aal1", amr: totp(1) }, now), false);
  assert.equal(
    platformMfaFresh(
      { aal: "aal2", amr: [{ method: "password", timestamp: now / 1000 }] },
      now,
    ),
    false,
  );
  assert.equal(platformMfaFresh({}, now), false);
});
