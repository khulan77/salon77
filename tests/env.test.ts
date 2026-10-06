import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
};
function inspect(overrides: Record<string, string | undefined> = {}) {
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      `const {configured,authEnv}=require('./lib/env.ts');let initialized=false;try{const value=authEnv();initialized=Boolean(value.url&&value.key);}catch{}process.stdout.write(JSON.stringify({configured,initialized}));`,
    ],
    { env: { ...process.env, ...base, ...overrides }, encoding: "utf8" },
  );
  return JSON.parse(output);
}
test("publishable-key configuration enables the same validated SSR auth configuration", () => {
  assert.deepEqual(inspect(), { configured: true, initialized: true });
});
test("missing publishable key fails closed even if the legacy variable exists", () => {
  assert.deepEqual(
    inspect({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-test-key",
    }),
    { configured: false, initialized: false },
  );
});
test("secret keys and template placeholders cannot configure public auth", () => {
  for (const key of ["sb_secret_test_fixture", "YOUR_PUBLISHABLE_KEY", " "])
    assert.deepEqual(inspect({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }), {
      configured: false,
      initialized: false,
    });
});
test("malformed Supabase URLs and database configuration fail closed", () => {
  for (const change of [
    { NEXT_PUBLIC_SUPABASE_URL: "not-a-url" },
    { NEXT_PUBLIC_SUPABASE_URL: "ftp://test.invalid" },
    { DATABASE_URL: "" },
    { DATABASE_URL: "YOUR_POOLED_DATABASE_URL" },
  ])
    assert.deepEqual(inspect(change), {
      configured: false,
      initialized: false,
    });
});
