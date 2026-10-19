import { db } from "@/lib/db";
import { platformAdminId } from "@/lib/auth";
import { assertPlatformAdmin } from "@/lib/services/platform";
import { pricePerBranch } from "@/lib/services/billing";
import { emailSetup } from "@/lib/notifications/platform-email";
import { PriceForm } from "@/components/platform/price-form";
import { NoticeForm } from "@/components/platform/notice-form";
import { listNotices } from "@/lib/services/notices";
import { formatTimeAgo } from "@/lib/ui-language";
const problems = {
  missing: "RESEND_FROM тохируулаагүй байна.",
  "free-mail":
    "RESEND_FROM нь Gmail зэрэг үнэгүй шуудангийн хаяг байна. Ийм хаягийг Resend-д баталгаажуулах боломжгүй тул илгээгч болгохгүй.",
  invalid:
    "RESEND_FROM нь баталгаажсан домэйны хаяг биш байна (жишээ: Salon77 <hello@salon77.mn>).",
} as const;
// Platform settings: the monthly price, and what the mail setup can send.
export default async function PlatformSettings() {
  const adminId = await platformAdminId();
  await assertPlatformAdmin(db, adminId);
  const [price, notices, mail] = [
    await pricePerBranch(db),
    await listNotices(db, adminId),
    emailSetup(),
  ];
  const rows = [
    {
      title: "Шинэ салон бүртгүүлэх үед танд",
      ok: mail.alerts,
      note: mail.alerts
        ? mail.ownerMail
          ? `${mail.alertTo} руу явна.`
          : `${mail.alertTo} руу явна. Домэйн тохируулаагүй үед зөвхөн Resend бүртгэлийн имэйл хаяг руу хүрнэ.`
        : "RESEND_API_KEY болон PLATFORM_ALERT_EMAIL хэрэгтэй.",
    },
    {
      title: "Шинэ санал хүсэлт ирэх үед танд",
      ok: mail.alerts,
      note: mail.alerts
        ? `${mail.alertTo} руу явна.`
        : "RESEND_API_KEY болон PLATFORM_ALERT_EMAIL хэрэгтэй.",
    },
    {
      title: "Салон баталгаажих, буцаагдах үед эзэнд",
      ok: mail.ownerMail,
      note: mail.ownerMail
        ? "Салоны эзний имэйл рүү явна."
        : "Баталгаажсан домэйн (RESEND_FROM) хэрэгтэй. Одоогоор илгээхгүй; шийдвэр зөвхөн салоны удирдлага дээр харагдана.",
    },
    {
      title: "Ресепшний урилга",
      ok: mail.ownerMail,
      note: mail.ownerMail
        ? "Уригдсан хүний имэйл рүү явна."
        : "Баталгаажсан домэйн хэрэгтэй. Одоогоор салоны эзэн линкийг хуулж явуулна.",
    },
  ];
  return (
    <>
      <div className="pf-heading">
        <h1>Тохиргоо</h1>
        <p>Сарын үнэ, салонуудад мэдэгдэл болон платформын имэйл илгээлт.</p>
      </div>
      <section className="pf-panel pf-price-panel" aria-labelledby="pf-price">
        <div>
          <h2 id="pf-price">Сарын үнэ</h2>
          <p className="pf-note">
            Туршилт баталгаажуулснаас хойш 14 хоног. Дараа нь салбар бүрээр 30
            хоног тутам төлнө.
          </p>
        </div>
        <PriceForm price={price} />
      </section>
      <section className="pf-panel" aria-labelledby="pf-notices">
        <div className="pf-panel-head">
          <h2 id="pf-notices">
            Салонуудад мэдэгдэл <span>{notices.length}</span>
          </h2>
        </div>
        <NoticeForm ownerMail={mail.ownerMail} />
        {notices.length > 0 && (
          <ul className="pf-notice-list">
            {notices.map((n) => (
              <li key={n.id}>
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>
                  {formatTimeAgo(n.createdAt)}
                  {n.emailed > 0 && ` · ${n.emailed} эзэнд имэйлээр очсон`}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="pf-panel" aria-labelledby="pf-mail">
        <div className="pf-panel-head">
          <h2 id="pf-mail">
            Имэйл (Resend){" "}
            <span>
              {mail.ownerMail
                ? "Бүрэн ажиллаж байна"
                : mail.alerts
                  ? "Хэсэгчлэн ажиллаж байна"
                  : "Тохируулаагүй"}
            </span>
          </h2>
        </div>
        <dl className="pf-facts">
          <div>
            <dt>Илгээгч (RESEND_FROM)</dt>
            <dd>
              {mail.fromProblem
                ? "Salon77 <onboarding@resend.dev> (Resend-ийн нийтийн хаяг)"
                : mail.from}
            </dd>
          </div>
          <div>
            <dt>Хариу хүлээн авах (reply-to)</dt>
            <dd>{mail.replyTo}</dd>
          </div>
          <div>
            <dt>Мэдэгдэл хүлээн авах (PLATFORM_ALERT_EMAIL)</dt>
            <dd>{mail.alertTo || "—"}</dd>
          </div>
          <div>
            <dt>RESEND_API_KEY</dt>
            <dd>{mail.apiKey ? "Тохируулсан" : "Тохируулаагүй"}</dd>
          </div>
        </dl>
        {mail.fromProblem && (
          <p className="pf-warning" role="status">
            {problems[mail.fromProblem]} Resend дээр salon77.mn зэрэг өөрийн
            домэйныг баталгаажуулаад RESEND_FROM-д тухайн домэйны хаягийг
            (жишээ: Salon77 &lt;hello@salon77.mn&gt;) оруулна уу.
          </p>
        )}
        <ul className="pf-mail-list">
          {rows.map((r) => (
            <li key={r.title} className={r.ok ? "ok" : "off"}>
              <strong>
                {r.ok ? "✓" : "✕"} {r.title}
              </strong>
              <small>{r.note}</small>
            </li>
          ))}
        </ul>
        <p className="pf-note">
          Gmail-ийг илгээгч болгох боломжгүй. Илгээгч нь үргэлж баталгаажсан
          домэйны хаяг, хариу нь {mail.replyTo} руу ирнэ. Дэлгэрэнгүйг
          docs/DEPLOYMENT.md-ээс харна уу.
        </p>
      </section>
    </>
  );
}
