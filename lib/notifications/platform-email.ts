import { after } from "next/server";
import { site } from "../site";
import { localStamp } from "../business-time";
// Platform mail through Resend: alerts to the operator (new salon, new
// feedback) and decisions to salon owners (approved, sent back).
const RESEND_URL = "https://api.resend.com/emails";
// Resend's shared sender only delivers to the Resend account's own address,
// so it covers the operator's alerts but never a salon owner.
const DEFAULT_FROM = "Salon77 <onboarding@resend.dev>";
// Replies land in the operator's inbox whatever the sender address is.
export const DEFAULT_REPLY_TO = "salon77.mn@gmail.com";
// Free mailboxes cannot be verified in Resend, so they never send.
const FREE_MAIL =
  /@(gmail\.com|googlemail\.com|yahoo\.com|hotmail\.com|outlook\.com|live\.com|icloud\.com|me\.com|mail\.ru|yandex\.(ru|com)|proton\.me|protonmail\.com)>?$/i;
type Env = Record<string, string | undefined>;
export type EmailSetup = {
  apiKey: boolean;
  alertTo: string;
  replyTo: string;
  // RESEND_FROM as set, and why it cannot be used, if it cannot.
  from: string;
  fromProblem: "missing" | "free-mail" | "invalid" | null;
  // Operator alerts work with the shared sender; owner mail needs a domain.
  alerts: boolean;
  ownerMail: boolean;
};
export function emailSetup(env: Env = process.env): EmailSetup {
  const from = env.RESEND_FROM?.trim() ?? "";
  const fromProblem = !from
    ? "missing"
    : FREE_MAIL.test(from)
      ? "free-mail"
      : /@[a-z0-9-]+(\.[a-z0-9-]+)+>?$/i.test(from) &&
          !/@resend\.dev>?$/i.test(from)
        ? null
        : "invalid";
  const apiKey = Boolean(env.RESEND_API_KEY?.trim()),
    alertTo = env.PLATFORM_ALERT_EMAIL?.trim() ?? "";
  return {
    apiKey,
    alertTo,
    replyTo: env.RESEND_REPLY_TO?.trim() || DEFAULT_REPLY_TO,
    from,
    fromProblem,
    alerts: apiKey && Boolean(alertTo),
    ownerMail: apiKey && fromProblem === null,
  };
}
type MailConfig = { apiKey: string; to: string; from: string; replyTo: string };
const sender = (env: Env) =>
  emailSetup(env).fromProblem === null ? env.RESEND_FROM!.trim() : DEFAULT_FROM;
// Alerts to the operator. Without a verified domain they still arrive when
// PLATFORM_ALERT_EMAIL is the Resend account's own address.
export function platformEmailConfig(env: Env = process.env): MailConfig | null {
  const setup = emailSetup(env);
  if (!setup.alerts) return null;
  return {
    apiKey: env.RESEND_API_KEY!.trim(),
    to: setup.alertTo,
    from: sender(env),
    replyTo: setup.replyTo,
  };
}
// Mail to a salon owner or an invited receptionist: only from a sender on a
// domain verified in Resend, since the shared sender cannot reach them.
export function ownerEmailConfig(
  to: string,
  env: Env = process.env,
): MailConfig | null {
  const setup = emailSetup(env);
  if (!setup.ownerMail || !to) return null;
  return {
    apiKey: env.RESEND_API_KEY!.trim(),
    to,
    from: sender(env),
    replyTo: setup.replyTo,
  };
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
// The owner learns why the application came back and where to correct it.
export function rejectionEmail(
  salon: { name: string; note: string },
  appUrl = siteUrl(),
) {
  return {
    subject: `«${salon.name}» салоны хүсэлтийг засах шаардлагатай`,
    text: [
      "Сайн байна уу,",
      "",
      `«${salon.name}» салоны бүртгэлийн хүсэлтийг тань буцаалаа.`,
      "",
      "Шалтгаан:",
      salon.note,
      "",
      `Мэдээллээ засаад дахин илгээх: ${appUrl}/onboarding/review`,
      "Асуух зүйл байвал энэ имэйлд хариу бичээрэй.",
      "",
      "Salon77",
    ].join("\n"),
  };
}
export function notifySalonRejected(
  to: string,
  salon: { name: string; note: string },
) {
  const config = ownerEmailConfig(to);
  if (!config) return;
  after(async () => {
    try {
      await sendPlatformEmail(rejectionEmail(salon), config);
    } catch {
      console.error("Salon77 rejection email failed");
    }
  });
}
export function feedbackAlert(
  feedback: {
    salonName: string;
    author: string;
    kind: string;
    message: string;
  },
  appUrl = siteUrl(),
) {
  return {
    subject: `Шинэ санал хүсэлт: ${feedback.salonName}`,
    text: [
      `«${feedback.salonName}» салоноос шинэ санал хүсэлт ирлээ.`,
      `Төрөл: ${feedback.kind}`,
      `Илгээсэн: ${feedback.author}`,
      "",
      feedback.message,
      "",
      `Хариулах: ${appUrl}/platform/feedback`,
    ].join("\n"),
  };
}
export function notifyFeedback(feedback: Parameters<typeof feedbackAlert>[0]) {
  if (!platformEmailConfig()) return;
  after(async () => {
    try {
      await sendPlatformEmail(feedbackAlert(feedback));
    } catch {
      console.error("Salon77 feedback alert email failed");
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
      reply_to: config.replyTo,
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
// Front-desk invitations reuse the owner mail settings; the owner can always
// copy the link instead.
export function inviteEmailReady(env: Env = process.env) {
  return emailSetup(env).ownerMail;
}
export function invitationEmail(invite: {
  name: string;
  salonName: string;
  branchName: string;
  link: string;
  expiresAt: Date;
}) {
  const ends = localStamp(invite.expiresAt).slice(0, 10).replace(/-/g, ".");
  return {
    subject: `«${invite.salonName}»-д ресепшнээр урьж байна`,
    text: [
      `Сайн байна уу, ${invite.name}.`,
      "",
      `«${invite.salonName}»-д ресепшнээр урьж байна. Доорх линкээр орж нууц үгээ үүсгээд нэвтэрнэ үү.`,
      "",
      invite.link,
      "",
      `Салбар: ${invite.branchName}`,
      `Линк ${ends} хүртэл хүчинтэй. Нууц үгийг хэн ч урьдчилж үүсгээгүй, та өөрөө үүсгэнэ.`,
      "",
      "Salon77",
    ].join("\n"),
  };
}
// Awaited so the owner learns right away whether the mail went out.
export async function sendInvitationEmail(
  to: string,
  invite: Parameters<typeof invitationEmail>[0],
) {
  const config = ownerEmailConfig(to);
  if (!config) return false;
  try {
    return await sendPlatformEmail(invitationEmail(invite), config);
  } catch {
    console.error("Salon77 invitation email failed");
    return false;
  }
}
