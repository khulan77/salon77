import test from "node:test";
import assert from "node:assert/strict";
import { storageConfig } from "../lib/storage";

const url = "https://demo.supabase.co";
test("photo storage names why uploads are off, without the key", () => {
  assert.deepEqual(storageConfig({ SUPABASE_SECRET_KEY: "sb_secret_abc" }), {
    ok: false,
    problem: "missing_url",
  });
  assert.deepEqual(storageConfig({ NEXT_PUBLIC_SUPABASE_URL: url }), {
    ok: false,
    problem: "missing_key",
  });
  for (const [key, problem] of [
    ["eyJhbGciOiJIUzI1NiJ9.e30.x", "legacy_jwt_key"],
    ["sb_publishable_abc", "publishable_key"],
    ["service-role", "invalid_key"],
  ])
    assert.deepEqual(
      storageConfig({
        NEXT_PUBLIC_SUPABASE_URL: url,
        SUPABASE_SECRET_KEY: key,
      }),
      { ok: false, problem },
    );
});
test("pasted quotes, spaces and a trailing slash are tolerated", () => {
  assert.deepEqual(
    storageConfig({
      NEXT_PUBLIC_SUPABASE_URL: `${url}/`,
      SUPABASE_SECRET_KEY: ' "sb_secret_abc"\n',
    }),
    { ok: true, url, key: "sb_secret_abc" },
  );
});
