import Link from "next/link";
import { db } from "@/lib/db";
import { platformAdminId } from "@/lib/auth";
import {
  listApplications,
  listPlatformSalons,
  platformOverview,
  salonListQuery,
} from "@/lib/services/platform";
import { billingOverview } from "@/lib/services/billing";
import { CountChart } from "@/components/platform/count-chart";
import { SalonStatusAction } from "@/components/platform/status-action";
import { PaymentAction } from "@/components/platform/payment-action";
import { PriceForm } from "@/components/platform/price-form";
import { SalonPrice } from "@/components/platform/salon-price";
import { formatMnt, formatTimeAgo } from "@/lib/ui-language";
import { BILLING_LABELS } from "@/lib/billing";
import { formatSitePhone } from "@/lib/site";
import { localStamp } from "@/lib/business-time";
import { serviceTypeLabel, socialUrl } from "@/lib/salon-application";
const date = (iso: string) => localStamp(iso).slice(0, 10).replace(/-/g, ".");
const sorts = [
  ["newest", "Шинэ нь эхэндээ"],
  ["activity", "Сүүлд идэвхтэй"],
  ["oldest", "Хуучин нь эхэндээ"],
  ["bookings", "Захиалга ихтэй"],
  ["name", "Нэрээр"],
] as const;
const billingFilters = [
  ["all", "Бүгд"],
  ["due", "Дуусах дөхсөн"],
  ["expired", "Хугацаа дууссан"],
  ["trial", "Туршилт"],
  ["paid", "Төлсөн"],
  ["pending", "Хүлээгдэж буй"],
] as const;
const badge: Record<string, string> = {
  PENDING: "wait",
  FREE: "plain",
  TRIAL: "wait",
  PAID: "ok",
  EXPIRED: "off",
};
export default async function PlatformHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const adminId = await platformAdminId();
  const q = await searchParams;
  const parsed = salonListQuery.safeParse({
    query: q.query ?? "",
    sort: q.sort ?? "newest",
    billing: q.billing ?? "all",
    page: q.page ?? "0",
  });
  const query = parsed.success ? parsed.data : salonListQuery.parse({});
  const [overview, applications, list, money] = await Promise.all([
    platformOverview(db, adminId),
    listApplications(db, adminId),
    listPlatformSalons(db, adminId, query),
    billingOverview(db, adminId),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const link = (page: number, billing: string = list.billing) =>
    `/platform?${new URLSearchParams({ query: list.query, sort: list.sort, billing, page: String(page) })}#pf-salons`;
  const focus = [
    {
      title: "Шинэ хүсэлт",
      value: String(applications.length),
      note: "Таны зөвшөөрлийг хүлээж байна",
      href: "#pf-applications",
      tone: applications.length ? "wait" : "",
    },
    {
      title: "Төлбөр дуусах дөхсөн",
      value: String(money.due),
      note: "3 хоногийн дотор дуусна",
      href: link(0, "due"),
      tone: money.due ? "wait" : "",
    },
    {
      title: "Хугацаа дууссан",
      value: String(money.expired),
      note: "Удирдлага, захиалга нь хаалттай",
      href: link(0, "expired"),
      tone: money.expired ? "off" : "",
    },
    {
      title: "Сүүлийн 30 хоногийн орлого",
      value: formatMnt(money.received30Mnt),
      note:
        money.monthlyMnt === null
          ? "Сарын үнээ тохируулна уу"
          : `Бүгд төлбөл сард ${formatMnt(money.monthlyMnt)}`,
      href: link(0, "paid"),
      tone: "",
    },
  ];
  const stats = [
    [
      "Нийт салон",
      overview.salons.total,
      `${overview.salons.active} идэвхтэй · ${overview.salons.suspended} зогсоосон · ${overview.salons.pending} хүлээгдэж буй`,
    ],
    [
      "Шинэ салон",
      overview.salons.new7,
      `Сүүлийн 7 хоногт · 30 хоногт ${overview.salons.new30}`,
    ],
    [
      "Онлайн захиалга",
      overview.onlineBookings.today,
      `Өнөөдөр · 7 хоногт ${overview.onlineBookings.days7} · 30 хоногт ${overview.onlineBookings.days30}`,
    ],
    ["Бүх захиалга", overview.bookings30, "Сүүлийн 30 хоногт үүссэн"],
    ["Салбар", overview.branches, "Идэвхтэй"],
    ["Үйлчилгээ", overview.services, "Идэвхтэй"],
    ["Ажилтан", overview.staff, "Идэвхтэй"],
  ] as const;
  return (
    <>
      <div className="pf-heading">
        <h1>Платформын тойм</h1>
        <p>
          {money.trial} салон туршилтад, {money.paid} салон төлбөртэй ашиглаж
          байна.
        </p>
      </div>
      <section className="pf-focus" aria-label="Анхаарах зүйлс">
        {focus.map((f) => (
          <Link key={f.title} href={f.href} className={f.tone}>
            <span>{f.title}</span>
            <strong>{f.value}</strong>
            <small>{f.note}</small>
          </Link>
        ))}
      </section>
      <section className="pf-panel pf-price-panel" aria-labelledby="pf-price">
        <div>
          <h2 id="pf-price">Сарын үнэ</h2>
          <p className="pf-note">
            Туршилт баталгаажуулснаас хойш 14 хоног. Дараа нь салбар бүрээр 30
            хоног тутам төлнө.
          </p>
        </div>
        <PriceForm price={money.pricePerBranchMnt} />
      </section>
      <section className="pf-panel" aria-labelledby="pf-applications">
        <div className="pf-panel-head">
          <h2 id="pf-applications">
            Шинэ хүсэлтүүд <span>{applications.length}</span>
          </h2>
        </div>
        {applications.length ? (
          <ul className="pf-queue">
            {applications.map((a) => {
              const instagram = socialUrl("instagram", a.instagram);
              const facebook = socialUrl("facebook", a.facebook);
              return (
                <li key={a.id}>
                  <div>
                    <Link href={`/platform/salons/${a.id}`} className="pf-name">
                      {a.name}
                    </Link>
                    {a.resubmitted && (
                      <em className="pf-badge wait">Дахин илгээсэн</em>
                    )}
                    <small>
                      {[a.district, a.address].filter(Boolean).join(" · ")}
                    </small>
                    <small>
                      {a.serviceTypes.map(serviceTypeLabel).join(", ")}
                      {a.staffCount ? ` · ${a.staffCount} ажилтан` : ""}
                    </small>
                  </div>
                  <div>
                    {a.ownerName || "—"}
                    <small>{a.ownerEmail}</small>
                    <small>Утас {a.phone}</small>
                  </div>
                  <div className="pf-socials">
                    {instagram && (
                      <a href={instagram} target="_blank" rel="noreferrer">
                        Инстаграм ↗
                      </a>
                    )}
                    {facebook && (
                      <a href={facebook} target="_blank" rel="noreferrer">
                        Фэйсбүүк ↗
                      </a>
                    )}
                    <small>Илгээсэн {formatTimeAgo(a.submittedAt)}</small>
                  </div>
                  <Link
                    href={`/platform/salons/${a.id}`}
                    className="pf-primary"
                  >
                    Шалгах
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="pf-note">Хянах хүсэлт алга.</p>
        )}
      </section>
      <section className="pf-panel" aria-labelledby="pf-salons">
        <div className="pf-panel-head">
          <h2 id="pf-salons">
            Салонууд <span>{list.total}</span>
          </h2>
          <form
            className="pf-filters"
            method="get"
            action="/platform#pf-salons"
          >
            <input type="hidden" name="billing" value={list.billing} />
            <input
              type="search"
              name="query"
              defaultValue={list.query}
              placeholder="Нэр эсвэл хаягаар хайх"
              aria-label="Салон хайх"
            />
            <select name="sort" defaultValue={list.sort} aria-label="Эрэмбэлэх">
              {sorts.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <button type="submit">Хайх</button>
          </form>
        </div>
        <nav className="pf-chips" aria-label="Төлбөрийн төлөвөөр шүүх">
          {billingFilters.map(([value, text]) => (
            <Link
              key={value}
              href={link(0, value)}
              aria-current={list.billing === value ? "true" : undefined}
            >
              {text}
            </Link>
          ))}
        </nav>
        {list.salons.length ? (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Салон</th>
                  <th>Салбар</th>
                  <th>Төлбөрийн төлөв</th>
                  <th>Сарын төлбөр</th>
                  <th>Салоны орлого, хэрэглээ</th>
                  <th>Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {list.salons.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/platform/salons/${s.id}`}
                        className="pf-name"
                      >
                        {s.name}
                      </Link>
                      <small>
                        {s.ownerName || "—"} · {s.ownerEmail}
                      </small>
                      <small>
                        <a href={`tel:${s.phone.replace(/\s/g, "")}`}>
                          Утас {formatSitePhone(s.phone)}
                        </a>
                      </small>
                      <small>
                        /{s.slug} · Бүртгүүлсэн {date(s.createdAt)}
                      </small>
                    </td>
                    <td className="num">{s.branches}</td>
                    <td>
                      <em className={`pf-badge ${badge[s.billing.state]}`}>
                        {BILLING_LABELS[s.billing.state]}
                      </em>
                      {s.status === "SUSPENDED" && (
                        <em className="pf-badge off">Хаасан</em>
                      )}
                      <small>
                        {s.billing.until
                          ? s.billing.state === "EXPIRED"
                            ? `${date(s.billing.until)}-нд дууссан`
                            : `${date(s.billing.until)} хүртэл · ${s.billing.daysLeft} хоног`
                          : s.reviewStatus === "REJECTED"
                            ? "Хүсэлтийг буцаасан"
                            : "—"}
                      </small>
                    </td>
                    <td>
                      {s.billing.state === "FREE" ? (
                        "—"
                      ) : (
                        <SalonPrice
                          id={s.id}
                          amountMnt={s.billing.amountMnt}
                          custom={s.billing.customPrice}
                        />
                      )}
                    </td>
                    <td>
                      <b>{formatMnt(s.revenueMonth)}</b>
                      <small>Энэ сарын орлого</small>
                      <small>
                        {s.online30} онлайн · {s.bookings} нийт захиалга
                      </small>
                      <small>
                        {s.ownerLastLoginAt
                          ? `Эзэн нэвтэрсэн ${formatTimeAgo(s.ownerLastLoginAt)}`
                          : "Нэвтрэлтийн бүртгэл алга"}
                      </small>
                    </td>
                    <td className="pf-row-actions">
                      {s.reviewStatus === "APPROVED" &&
                        s.billing.state !== "FREE" &&
                        s.billing.amountMnt !== null && (
                          <PaymentAction
                            id={s.id}
                            name={s.name}
                            amountMnt={s.billing.amountMnt}
                            branches={s.branches}
                            nextEnd={s.billing.nextEnd}
                          />
                        )}
                      <SalonStatusAction
                        id={s.id}
                        name={s.name}
                        status={s.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pf-empty">
            {list.query || list.billing !== "all"
              ? "Шүүлтүүрт тохирох салон алга."
              : "Одоогоор бүртгэлтэй салон алга."}
          </p>
        )}
        {pages > 1 && (
          <nav className="pf-pager" aria-label="Хуудаслалт">
            {list.page > 0 && <Link href={link(list.page - 1)}>Өмнөх</Link>}
            <span>
              {list.page + 1} / {pages}
            </span>
            {list.page + 1 < pages && (
              <Link href={link(list.page + 1)}>Дараах</Link>
            )}
          </nav>
        )}
      </section>
      <section className="pf-usage" aria-labelledby="pf-usage">
        <h2 id="pf-usage">Хэрэглээ</h2>
        <div className="pf-stats">
          {stats.map(([title, value, note]) => (
            <article key={title}>
              <span>{title}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="pf-panel pf-charts">
        <CountChart
          data={overview.weekly}
          label="Шинээр бүртгүүлсэн салон · 7 хоног тутам"
          endLabel="Энэ долоо хоног"
        />
        <CountChart
          data={overview.daily}
          label="Өдөр бүрийн онлайн захиалга · 30 хоног"
        />
      </section>
    </>
  );
}
