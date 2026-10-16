import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationAlert,
  approvalEmail,
  emailSetup,
  feedbackAlert,
  rejectionEmail,
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
      replyTo: "salon77.mn@gmail.com",
    },
  );
});
test("a free mailbox is never the sender; replies go to the operator", () => {
  const base = { RESEND_API_KEY: "re_x", PLATFORM_ALERT_EMAIL: "me@x.mn" };
  for (const from of ["salon77.mn@gmail.com", "Salon77 <a@yahoo.com>"]) {
    const setup = emailSetup({ ...base, RESEND_FROM: from });
    assert.equal(setup.fromProblem, "free-mail");
    assert.equal(setup.ownerMail, false);
    assert.equal(
      platformEmailConfig({ ...base, RESEND_FROM: from })?.from,
      "Salon77 <onboarding@resend.dev>",
    );
  }
  const domain = { ...base, RESEND_FROM: "Salon77 <hello@salon77.mn>" };
  assert.equal(emailSetup(domain).ownerMail, true);
  assert.equal(platformEmailConfig(domain)?.from, "Salon77 <hello@salon77.mn>");
  assert.equal(emailSetup(base).fromProblem, "missing");
  assert.equal(
    emailSetup({ ...base, RESEND_FROM: "onboarding@resend.dev" }).fromProblem,
    "invalid",
  );
  assert.equal(
    emailSetup({ ...domain, RESEND_REPLY_TO: "help@salon77.mn" }).replyTo,
    "help@salon77.mn",
  );
});
test("rejection and feedback mails carry the reason and links", () => {
  const back = rejectionEmail(
    { name: "Гоо Нэйлс", note: "Инстаграм холбоос ажиллахгүй байна." },
    "https://salon77.mn",
  );
  assert.match(back.subject, /засах шаардлагатай/);
  assert.match(back.text, /Инстаграм холбоос ажиллахгүй/);
  assert.match(back.text, /https:\/\/salon77\.mn\/onboarding\/review/);
  const alert = feedbackAlert(
    {
      salonName: "Гоо Нэйлс",
      author: "Сараа",
      kind: "Асуулт",
      message: "Хэрхэн салбар нэмэх вэ?",
    },
    "https://salon77.mn",
  );
  assert.equal(alert.subject, "Шинэ санал хүсэлт: Гоо Нэйлс");
  assert.match(alert.text, /Төрөл: Асуулт/);
  assert.match(alert.text, /\/platform\/feedback/);
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
  const config = {
    apiKey: "re_x",
    to: "me@example.test",
    from: "A <a@b.c>",
    replyTo: "salon77.mn@gmail.com",
  };
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
    reply_to: "salon77.mn@gmail.com",
    subject: message.subject,
    text: message.text,
  });
  status = 401;
  await assert.rejects(sendPlatformEmail(message, config, send));
});
test("an approved salon's owner gets a congratulation with links", () => {
  assert.equal(ownerEmailConfig("owner@example.test", {}), null);
  assert.equal(ownerEmailConfig("", { RESEND_API_KEY: "re_x" }), null);
  // The shared sender cannot reach owners, so a verified domain is needed.
  assert.equal(
    ownerEmailConfig("owner@example.test", { RESEND_API_KEY: "re_x" }),
    null,
  );
  assert.equal(
    ownerEmailConfig("owner@example.test", {
      RESEND_API_KEY: "re_x",
      RESEND_FROM: "Salon77 <hello@salon77.mn>",
    })?.to,
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
