import { test } from "node:test";
import assert from "node:assert/strict";

test("social profile links come from the environment and only as https", async () => {
  process.env.NEXT_PUBLIC_FACEBOOK_URL = " https://facebook.com/salon77 ";
  process.env.NEXT_PUBLIC_INSTAGRAM_URL = "javascript:alert(1)";
  const { site } = await import("../lib/site");
  assert.equal(site.facebook, "https://facebook.com/salon77");
  // Anything that is not an absolute https link hides the icon.
  assert.equal(site.instagram, "");
  assert.equal(site.email, "salon77.mn@gmail.com");
});
