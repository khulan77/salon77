import Link from "next/link";
import { db } from "@/lib/db";
import { platformAdminId } from "@/lib/auth";
import {
  listPlatformSalons,
  platformOverview,
  salonListQuery,
} from "@/lib/services/platform";
import { CountChart } from "@/components/platform/count-chart";
import { formatTimeAgo } from "@/lib/ui-language";
import { localStamp } from "@/lib/business-time";
const date = (iso: string) => localStamp(iso).slice(0, 10).replace(/-/g, ".");
const sorts = [
  ["newest", "Шинэ нь эхэндээ"],
  ["activity", "Сүүлд идэвхтэй"],
  ["oldest", "Хуучин нь эхэндээ"],
  ["bookings", "Захиалга ихтэй"],
  ["name", "Нэрээр"],
] as const;
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
    page: q.page ?? "0",
  });
  const query = parsed.success ? parsed.data : salonListQuery.parse({});
  const [overview, list] = await Promise.all([
    platformOverview(db, adminId),
    listPlatformSalons(db, adminId, query),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const link = (page: number) =>
    `/platform?${new URLSearchParams({ query: list.query, sort: list.sort, page: String(page) })}`;
  const stats = [
    [
      "Нийт салон",
      overview.salons.total,
      `${overview.salons.active} идэвхтэй · ${overview.salons.suspended} зогсоосон`,
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
        <p>Бүртгэлтэй салонууд болон тэдний хэрэглээ.</p>
      </div>
      <section className="pf-stats" aria-label="Үндсэн үзүүлэлтүүд">
        {stats.map(([title, value, note]) => (
          <article key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
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
      <section className="pf-panel" aria-labelledby="pf-salons">
        <div className="pf-panel-head">
          <h2 id="pf-salons">
            Салонууд <span>{list.total}</span>
          </h2>
          <form className="pf-filters" method="get" action="/platform">
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
        {list.salons.length ? (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Салон</th>
                  <th>Эзэмшигч</th>
                  <th>Бүртгүүлсэн</th>
                  <th>Салбар</th>
                  <th>Үйлчилгээ</th>
                  <th>Ажилтан</th>
                  <th>Онлайн · 30 хоног</th>
                  <th>Нийт захиалга</th>
                  <th>Сүүлийн идэвх</th>
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
                        /{s.slug}
                        {s.status === "SUSPENDED" && (
                          <em className="pf-badge off">Зогсоосон</em>
                        )}
                      </small>
                    </td>
                    <td>
                      {s.ownerName || "—"}
                      <small>{s.ownerEmail}</small>
                    </td>
                    <td>{date(s.createdAt)}</td>
                    <td className="num">{s.branches}</td>
                    <td className="num">{s.services}</td>
                    <td className="num">{s.staff}</td>
                    <td className="num">
                      <b>{s.online30}</b>
                    </td>
                    <td className="num">{s.bookings}</td>
                    <td>
                      {s.lastBookingAt
                        ? `Захиалга ${formatTimeAgo(s.lastBookingAt)}`
                        : "Захиалга алга"}
                      <small>
                        {s.ownerLastLoginAt
                          ? `Эзэн нэвтэрсэн ${formatTimeAgo(s.ownerLastLoginAt)}`
                          : "Нэвтрэлтийн бүртгэл алга"}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pf-empty">
            {list.query
              ? "Хайлтад тохирох салон алга."
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
    </>
  );
}
