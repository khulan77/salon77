import { test } from "node:test";
import assert from "node:assert/strict";
import { createInvitedUser } from "../lib/auth-admin";
const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};
const input = { email: "a@example.com", password: "Secret123", name: "Сараа" };
test("invited accounts are created confirmed through the admin API", async () => {
  let sent: { url: string; body: Record<string, unknown> } | undefined;
  const result = await createInvitedUser(input, env, (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    sent = { url: String(url), body: JSON.parse(String(init?.body)) };
    return new Response("{}", { status: 200 });
  }) as typeof fetch);
  assert.deepEqual(result, { ok: true });
  assert.equal(sent?.url, "https://project.supabase.co/auth/v1/admin/users");
  assert.equal(sent?.body.email_confirm, true);
  assert.equal(sent?.body.email, input.email);
});
test("an existing email and a missing key are reported, not thrown", async () => {
  const exists = await createInvitedUser(
    input,
    env,
    (async () =>
      new Response(JSON.stringify({ error_code: "email_exists" }), {
        status: 422,
      })) as unknown as typeof fetch,
  );
  assert.deepEqual(exists, { ok: false, reason: "exists" });
  assert.deepEqual(
    await createInvitedUser(input, { ...env, SUPABASE_SECRET_KEY: "" }),
    { ok: false, reason: "unavailable" },
  );
});
