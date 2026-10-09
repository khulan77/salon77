import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { MapPin, Search, Sparkles, Tag } from "lucide-react";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { directoryQuery, listDirectory } from "@/lib/services/directory";
import { formatMnt } from "@/lib/ui-language";
import { initials } from "@/lib/avatar";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salon77 · Гоо сайхны салонд онлайнаар цаг захиалах",
  description:
    "Хумс, үс, сормуус, арьс арчилгааны салонуудаас сонгоод цагаа онлайнаар захиалаарай.",
};
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const parsed = directoryQuery.safeParse({
    query: q.query ?? "",
    district: q.district ?? "",
    page: q.page ?? "0",
  });
  const input = parsed.success ? parsed.data : directoryQuery.parse({});
  const data = configured
    ? await listDirectory(db, input)
    : { ...input, total: 0, pageSize: 24, districts: [], salons: [] };
  const filtered = Boolean(data.query || data.district);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const link = (page: number) =>
    `/?${new URLSearchParams({ query: data.query, district: data.district, page: String(page) })}`;
  return (
    <div className="lp hp">
      <header className="lp-nav">
        <Link href="/" className="lp-logo" aria-label="Salon77 нүүр">
          <span className="lp-logo-mark">s</span>
          salon77<span className="lp-dot">.</span>
        </Link>
        <div className="lp-nav-actions">
          <Link href="/sign-in" className="lp-link hp-hide-sm">
            Нэвтрэх
          </Link>
          <Link href="/business" className="lp-btn small outline">
            Салоноо бүртгүүлэх
          </Link>
        </div>
      </header>
      <main>
        <section className="hp-hero">
          <span className="lp-pill">
            <Sparkles size={13} /> Хумс, үс, сормуус, арьс арчилгаа
          </span>
          <h1>
            Гоо сайхны салонд
            <br />
            цагаа онлайнаар захиал<span className="lp-dot">.</span>
          </h1>
          <p>Салоноо сонгоод сул цагаа хараад хэдхэн товшилтоор захиална.</p>
          <form className="hp-search" method="get" action="/" role="search">
            <label>
              <Search size={18} />
              <input
                type="search"
                name="query"
                defaultValue={data.query}
                placeholder="Салон эсвэл үйлчилгээ"
                aria-label="Салон эсвэл үйлчилгээ хайх"
              />
            </label>
            <label>
              <MapPin size={18} />
              <select
                name="district"
                defaultValue={data.district}
                aria-label="Дүүрэг"
              >
                <option value="">Бүх дүүрэг</option>
                {data.districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Хайх</button>
          </form>
        </section>
        <section className="hp-results" aria-labelledby="hp-title">
          <div className="hp-results-head">
            <h2 id="hp-title">
              {filtered ? "Хайлтын үр дүн" : "Салонууд"}
              <span>{data.total}</span>
            </h2>
            {filtered && (
              <Link href="/" className="lp-link underline">
                Шүүлтүүр арилгах
              </Link>
            )}
          </div>
          {data.salons.length ? (
            <ul className="hp-grid">
              {data.salons.map((s) => (
                <li key={s.slug}>
                  <Link href={`/${s.slug}/book`} className="hp-card">
                    <div className="hp-cover">
                      {s.coverUrl ? (
                        <Image
                          src={s.coverUrl}
                          alt=""
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, 360px"
                        />
                      ) : (
                        <span aria-hidden="true">{initials(s.name)}</span>
                      )}
                      {s.hasDiscount && (
                        <em className="hp-sale">
                          <Tag size={12} /> Хямдралтай
                        </em>
                      )}
                    </div>
                    <div className="hp-body">
                      <h3>{s.name}</h3>
                      {(s.district || s.address) && (
                        <p className="hp-place">
                          <MapPin size={13} />
                          {[s.district, s.address].filter(Boolean).join(", ")}
                        </p>
                      )}
                      <div className="hp-meta">
                        <span>{s.services} үйлчилгээ</span>
                        {s.fromMnt > 0 && (
                          <b>{formatMnt(s.fromMnt)}-с эхэлнэ</b>
                        )}
                      </div>
                      <span className="hp-book">Цаг захиалах</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="hp-empty">
              {filtered ? (
                <>
                  <h3>Тохирох салон олдсонгүй</h3>
                  <p>Өөр нэр, үйлчилгээ эсвэл дүүргээр хайгаад үзээрэй.</p>
                </>
              ) : (
                <>
                  <h3>Удахгүй энд салонууд нэмэгдэнэ</h3>
                  <p>
                    Салон эзэмшдэг бол одоо бүртгүүлж эхний эгнээнд харагдаарай.
                  </p>
                  <Link href="/business" className="lp-btn small">
                    Салоноо бүртгүүлэх
                  </Link>
                </>
              )}
            </div>
          )}
          {pages > 1 && (
            <nav className="pf-pager" aria-label="Хуудаслалт">
              {data.page > 0 && <Link href={link(data.page - 1)}>Өмнөх</Link>}
              <span>
                {data.page + 1} / {pages}
              </span>
              {data.page + 1 < pages && (
                <Link href={link(data.page + 1)}>Дараах</Link>
              )}
            </nav>
          )}
        </section>
        <section className="hp-owner">
          <div>
            <h2>Салон эзэмшдэг үү?</h2>
            <p>
              Салоноо бүртгүүлээд онлайн захиалга, календарь, ажилтан, тайлангаа
              нэг дороос удирдаарай.
            </p>
          </div>
          <Link href="/business" className="lp-btn light">
            Салоноо бүртгүүлэх
          </Link>
        </section>
      </main>
      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} Salon77</span>
        <Link href="/business">Салон эзэмшигчдэд</Link>
      </footer>
    </div>
  );
}
