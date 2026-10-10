import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { platformAdminId } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { platformSalonDetail } from "@/lib/services/platform";
import { CountChart } from "@/components/platform/count-chart";
import { SalonStatusAction } from "@/components/platform/status-action";
import { ReviewAction } from "@/components/platform/review-action";
import {
  REVIEW_LABELS,
  serviceTypeLabel,
  socialUrl,
} from "@/lib/salon-application";
import { formatTimeAgo, roleLabel } from "@/lib/ui-language";
import { sourceLabels, statusLabels } from "@/lib/booking-validation";
import { localStamp } from "@/lib/business-time";
import { clockTime } from "@/lib/schedule-time";
const date = (iso: string) => localStamp(iso).slice(0, 10).replace(/-/g, ".");
const actions: Record<string, string> = {
  SUSPEND_SALON: "Түр зогсоосон",
  ACTIVATE_SALON: "Дахин идэвхжүүлсэн",
  APPROVE_SALON: "Хүсэлтийг зөвшөөрсөн",
  REJECT_SALON: "Хүсэлтийг буцаасан",
};
export default async function PlatformSalon({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminId = await platformAdminId();
  const { id } = await params;
  let salon;
  try {
    salon = await platformSalonDetail(db, adminId, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const online30 = salon.bySource.ONLINE ?? 0;
  const application = salon.application;
  const instagram = socialUrl("instagram", application.instagram);
  const facebook = socialUrl("facebook", application.facebook);
  const firstBranch = salon.branches[0];
  return (
    <>
      <Link href="/platform" className="pf-back">
        <ArrowLeft size={14} /> Бүх салон
      </Link>
      <div className="pf-heading pf-heading-row">
        <div>
          <h1>
            {salon.name}
            {salon.status === "SUSPENDED" && (
              <em className="pf-badge off">Зогсоосон</em>
            )}
            {application.status !== "APPROVED" && (
              <em
                className={`pf-badge ${application.status === "PENDING" ? "wait" : "off"}`}
              >
                {REVIEW_LABELS[application.status]}
              </em>
            )}
          </h1>
          <p>
            <a href={`/${salon.slug}/book`} target="_blank" rel="noreferrer">
              /{salon.slug}/book
            </a>{" "}
            · Бүртгүүлсэн {date(salon.createdAt)} · Утас {salon.phone}
          </p>
        </div>
        <SalonStatusAction
          id={salon.id}
          name={salon.name}
          status={salon.status}
        />
      </div>
      <section className="pf-panel" aria-labelledby="pf-application">
        <div className="pf-panel-head">
          <h2 id="pf-application">
            Бүртгэлийн хүсэлт <span>{REVIEW_LABELS[application.status]}</span>
          </h2>
        </div>
        <dl className="pf-facts">
          <div>
            <dt>Инстаграм</dt>
            <dd>
              {instagram ? (
                <a href={instagram} target="_blank" rel="noreferrer">
                  {application.instagram} ↗
                </a>
              ) : (
                application.instagram || "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Фэйсбүүк</dt>
            <dd>
              {facebook ? (
                <a href={facebook} target="_blank" rel="noreferrer">
                  {application.facebook} ↗
                </a>
              ) : (
                application.facebook || "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Үйлчилгээний төрөл</dt>
            <dd>
              {application.serviceTypes.map(serviceTypeLabel).join(", ") || "—"}
            </dd>
          </div>
          <div>
            <dt>Ажилтны тоо</dt>
            <dd>{application.staffCount ?? "—"}</dd>
          </div>
          <div>
            <dt>Утас</dt>
            <dd>{salon.phone}</dd>
          </div>
          <div>
            <dt>Хаяг</dt>
            <dd>
              {firstBranch
                ? [firstBranch.district, firstBranch.address]
                    .filter(Boolean)
                    .join(" · ")
                : "—"}
            </dd>
          </div>
          <div className="wide">
            <dt>Танилцуулга</dt>
            <dd>{application.description || "—"}</dd>
          </div>
          {application.submittedAt && (
            <div>
              <dt>Илгээсэн</dt>
              <dd>{formatTimeAgo(application.submittedAt)}</dd>
            </div>
          )}
          {application.status === "REJECTED" && application.note && (
            <div className="wide">
              <dt>Буцаасан шалтгаан</dt>
              <dd>{application.note}</dd>
            </div>
          )}
        </dl>
        <ReviewAction
          id={salon.id}
          name={salon.name}
          status={application.status}
        />
      </section>
      <section className="pf-stats" aria-label="Салоны үзүүлэлтүүд">
        {(
          [
            ["Салбар", salon.branches.filter((b) => b.active).length],
            ["Үйлчилгээ", salon.services],
            ["Ажилтан", salon.staff],
            ["Онлайн · 30 хоног", online30],
            ["Нийт захиалга", salon.bookings],
          ] as const
        ).map(([title, value]) => (
          <article key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="pf-panel">
        <CountChart
          data={salon.daily}
          label="Өдөр бүрийн онлайн захиалга · 30 хоног"
        />
        <p className="pf-note">
          {salon.lastBookingAt
            ? `Сүүлийн захиалга ${formatTimeAgo(salon.lastBookingAt)} үүссэн.`
            : "Одоогоор захиалга алга."}
        </p>
      </section>
      <div className="pf-grid">
        <section className="pf-panel">
          <h2>Сүүлийн 30 хоногийн захиалга</h2>
          <dl className="pf-list">
            {Object.entries(sourceLabels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{salon.bySource[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <dl className="pf-list">
            {Object.entries(statusLabels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{salon.byStatus[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="pf-panel">
          <h2>Салбарууд</h2>
          <ul className="pf-rows">
            {salon.branches.map((b) => (
              <li key={b.id}>
                <span>
                  {b.name}
                  <small>{b.district}</small>
                </span>
                <b>
                  {clockTime(b.openMinute)}–{clockTime(b.closeMinute)}
                  {!b.active && " · Идэвхгүй"}
                </b>
              </li>
            ))}
          </ul>
          <h2>Үйлчилгээ ангиллаар</h2>
          {salon.servicesByCategory.length ? (
            <ul className="pf-rows">
              {salon.servicesByCategory.map((c) => (
                <li key={c.name}>
                  <span>{c.name}</span>
                  <b>{c.count}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pf-note">Идэвхтэй үйлчилгээ алга.</p>
          )}
        </section>
      </div>
      <section className="pf-panel">
        <h2>Гишүүд</h2>
        <ul className="pf-rows">
          {salon.members.map((m) => (
            <li key={m.id}>
              <span>
                {m.name || m.email}
                <small>
                  {roleLabel(m.role)} · {m.email}
                  {!m.active && " · Идэвхгүй"}
                </small>
              </span>
              <b>
                {m.lastLoginAt
                  ? `Нэвтэрсэн ${formatTimeAgo(m.lastLoginAt)}`
                  : "Нэвтрэлтийн бүртгэл алга"}
              </b>
            </li>
          ))}
        </ul>
      </section>
      {salon.audit.length > 0 && (
        <section className="pf-panel">
          <h2>Платформын үйлдлүүд</h2>
          <ul className="pf-rows">
            {salon.audit.map((a) => (
              <li key={a.createdAt + a.action}>
                <span>
                  {actions[a.action] ?? a.action}
                  <small>{a.actorEmail}</small>
                </span>
                <b>{localStamp(a.createdAt).replace("T", " ")}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
