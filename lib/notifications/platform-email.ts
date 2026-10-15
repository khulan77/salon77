import { after } from "next/server";
import { site } from "../site";
import { localStamp } from "../business-time";
// Emails the platform operator when a salon application needs review.
// Off unless RESEND_API_KEY and PLATFORM_ALERT_EMAIL are set.
const RESEND_URL = "https://api.resend.com/emails";
// Resend's shared sender only delivers to the Resend account's own address,
// which suits a single operator; set RESEND_FROM once a domain is verified.
const DEFAULT_FROM = "Salon77 <onboarding@resend.dev>";
export function platformEmailConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const apiKey = env.RESEND_API_KEY?.trim(),
    to = env.PLATFORM_ALERT_EMAIL?.trim();
  if (!apiKey || !to) return null;
  return { apiKey, to, from: env.RESEND_FROM?.trim() || DEFAULT_FROM };
}
// Mail to a salon owner needs only the key. Resend's shared sender delivers
// just to the Resend account's own address, so owners receive it once
// RESEND_FROM uses a domain verified in Resend.
export function ownerEmailConfig(
  to: string,
  env: Record<string, string | undefined> = process.env,
) {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey || !to) return null;
  return { apiKey, to, from: env.RESEND_FROM?.trim() || DEFAULT_FROM };
}
const siteUrl = () =>
  process.env.APP_URL?.replace(/\/$/, "") || `https://${site.domain}`;
export function approvalEmail(
  salon: { name: string; slug: string; trialEndsAt: Date | null },
  appUrl = siteUrl(),
) {
  const ends = salon.trialEndsAt
    ? localStamp(salon.trialEndsAt).slice(0, 10).replace(/-/g, ".")
    : null;
  return {
    subject: `«${salon.name}» салон тань баталгаажлаа`,
    text: [
      "Сайн байна уу,",
      "",
      `«${salon.name}» салон тань Salon77-д баталгаажлаа. Танд амжилт хүсье!`,
      "",
      "Удирдлагын бүх хэсэг нээгдэж, онлайн захиалгын хуудас тань ажиллаж эхэллээ:",
      `${appUrl}/${salon.slug}/book`,
      "",
      ...(ends
        ? [`14 хоногийн үнэгүй туршилт өнөөдөр эхэлж, ${ends}-нд дуусна.`, ""]
        : []),
      `Удирдлагын хэсэгт нэвтрэх: ${appUrl}/sign-in`,
      "",
      "Salon77",
    ].join("\n"),
  };
}
// Sent after the response, like the operator alerts.
export function notifySalonApproved(
  to: string,
  salon: { name: string; slug: string; trialEndsAt: Date | null },
) {
  const config = ownerEmailConfig(to);
  if (!config) return;
  after(async () => {
    try {
      await sendPlatformEmail(approvalEmail(salon), config);
    } catch {
      console.error("Salon77 approval email failed");
    }
  });
}
export function applicationAlert(
  salon: { id: string; name: string; ownerEmail: string },
  resubmitted: boolean,
  appUrl = process.env.APP_URL?.replace(/\/$/, ""),
) {
  const link = `${appUrl ?? ""}/platform/salons/${salon.id}`;
  return {
    subject: resubmitted
      ? `Засаад дахин илгээсэн: ${salon.name}`
      : `Шинэ салон бүртгүүллээ: ${salon.name}`,
    text: [
      resubmitted
        ? `«${salon.name}» салон мэдээллээ засаад дахин илгээлээ.`
        : `«${salon.name}» салон бүртгүүлж, баталгаажуулалт хүлээж байна.`,
      `Эзэмшигч: ${salon.ownerEmail}`,
      "",
      `Шалгах: ${link}`,
    ].join("\n"),
  };
}
export async function sendPlatformEmail(
  message: { subject: string; text: string },
  config = platformEmailConfig(),
  send: typeof fetch = fetch,
) {
  if (!config) return false;
  const response = await send(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [config.to],
      subject: message.subject,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}`);
  return true;
}
// Sent after the response: a mail problem never blocks the salon owner.
export function notifyApplication(
  salon: { id: string; name: string; ownerEmail: string },
  resubmitted: boolean,
) {
  if (!platformEmailConfig()) return;
  after(async () => {
    try {
      await sendPlatformEmail(applicationAlert(salon, resubmitted));
    } catch {
      console.error("Salon77 platform alert email failed");
    }
  });
}
