import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationAlert,
  approvalEmail,
  ownerEmailConfig,
  platformEmailConfig,
  sendPlatformEmail,
} from "../lib/notifications/platform-email";
const salon = { id: "s1", name: "Гоо Нэйлс", ownerEmail: "owner@example.test" };
test("platform alerts are off until Resend and the address are set", () => {
  assert.equal(platformEmailConfig({}), null);
  assert.equal(platformEmailConfig({ RESEND_API_KEY: "re_x" }), null);
  assert.deepEqual(
    platformEmailConfig({
      RESEND_API_KEY: "re_x",
      PLATFORM_ALERT_EMAIL: "me@example.test",
    }),
    {
      apiKey: "re_x",
      to: "me@example.test",
      from: "Salon77 <onboarding@resend.dev>",
    },
  );
});
test("the alert names the salon and links to its review page", () => {
  const fresh = applicationAlert(salon, false, "https://salon77.mn");
  assert.equal(fresh.subject, "Шинэ салон бүртгүүллээ: Гоо Нэйлс");
  assert.match(fresh.text, /owner@example\.test/);
  assert.match(fresh.text, /https:\/\/salon77\.mn\/platform\/salons\/s1/);
  assert.match(
    applicationAlert(salon, true, "https://salon77.mn").subject,
    /^Засаад дахин илгээсэн/,
  );
});
test("the email goes to Resend with the configured sender", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  let status = 200;
  const send = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("{}", { status });
  }) as typeof fetch;
  const config = { apiKey: "re_x", to: "me@example.test", from: "A <a@b.c>" };
  const message = applicationAlert(salon, false, "");
  assert.equal(await sendPlatformEmail(message, null, send), false);
  assert.equal(calls.length, 0);
  assert.equal(await sendPlatformEmail(message, config, send), true);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Authorization,
    "Bearer re_x",
  );
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    from: "A <a@b.c>",
    to: ["me@example.test"],
    subject: message.subject,
    text: message.text,
  });
  status = 401;
  await assert.rejects(sendPlatformEmail(message, config, send));
});
test("an approved salon's owner gets a congratulation with links", () => {
  assert.equal(ownerEmailConfig("owner@example.test", {}), null);
  assert.equal(ownerEmailConfig("", { RESEND_API_KEY: "re_x" }), null);
  assert.equal(
    ownerEmailConfig("owner@example.test", { RESEND_API_KEY: "re_x" })?.to,
    "owner@example.test",
  );
  const mail = approvalEmail(
    {
      name: "Гоо Нэйлс",
      slug: "goo-neils",
      trialEndsAt: new Date("2026-10-29T04:00:00Z"),
    },
    "https://salon77.mn",
  );
  assert.equal(mail.subject, "«Гоо Нэйлс» салон тань баталгаажлаа");
  assert.match(mail.text, /Танд амжилт хүсье!/);
  assert.match(mail.text, /https:\/\/salon77\.mn\/goo-neils\/book/);
  assert.match(mail.text, /2026\.10\.29-нд дуусна/);
  assert.match(mail.text, /https:\/\/salon77\.mn\/sign-in/);
});
