import test from "node:test";
import assert from "node:assert/strict";
import { smsDelivers, smsProvider } from "../lib/notifications/provider";
const keys = [
  "SMS_PROVIDER",
  "SMS_HTTP_URL",
  "SMS_HTTP_API_KEY",
  "SMS_SENDER",
] as const;
function withEnv(values: Partial<Record<(typeof keys)[number], string>>) {
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, values);
}
test("SMS is promised only when a real gateway is configured", () => {
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    withEnv({});
    assert.equal(smsProvider(), null);
    assert.equal(smsDelivers(), false);
    withEnv({ SMS_PROVIDER: "log" });
    assert.equal(smsProvider()?.name, "log");
    assert.equal(smsDelivers(), false);
    // An incomplete gateway setup sends nothing rather than failing later.
    withEnv({ SMS_PROVIDER: "http", SMS_HTTP_URL: "https://sms.test/send" });
    assert.equal(smsProvider(), null);
    assert.equal(smsDelivers(), false);
    withEnv({
      SMS_PROVIDER: "http",
      SMS_HTTP_URL: "https://sms.test/send",
      SMS_HTTP_API_KEY: "key",
      SMS_SENDER: "Salon77",
    });
    assert.equal(smsProvider()?.name, "http");
    assert.equal(smsDelivers(), true);
  } finally {
    for (const k of keys)
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
  }
});
test("the http gateway posts the message and reports failures in Mongolian", async () => {
  const realFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  let status = 200;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: 42 }), { status });
  }) as typeof fetch;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    withEnv({
      SMS_PROVIDER: "http",
      SMS_HTTP_URL: "https://sms.test/send",
      SMS_HTTP_API_KEY: "key",
      SMS_SENDER: "Salon77",
    });
    const provider = smsProvider()!;
    assert.deepEqual(await provider.send("99112233", "Сайн байна уу"), {
      messageId: "42",
    });
    assert.equal(calls[0].url, "https://sms.test/send");
    assert.equal(
      (calls[0].init.headers as Record<string, string>).Authorization,
      "Bearer key",
    );
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      to: "99112233",
      from: "Salon77",
      text: "Сайн байна уу",
    });
    status = 500;
    await assert.rejects(provider.send("99112233", "х"), /алдаа буцаалаа/);
  } finally {
    globalThis.fetch = realFetch;
    for (const k of keys)
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
  }
});
