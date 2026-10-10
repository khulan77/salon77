import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Droplets,
  Eye,
  Flower2,
  Hand,
  Paintbrush,
  Scissors,
  CalendarCheck,
  Images,
  MapPin,
  MousePointerClick,
  Search,
  Sparkles,
  Store,
  Tag,
} from "lucide-react";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { directoryQuery, listDirectory } from "@/lib/services/directory";
import { formatMnt } from "@/lib/ui-language";
import { initials, tone } from "@/lib/avatar";
import { site, formatSitePhone } from "@/lib/site";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salon77 · Гоо сайхны салонд онлайнаар цаг захиалах",
  description:
    "Хумс, үс, сормуус, арьс арчилгааны салонуудаас сонгоод цагаа онлайнаар захиалаарай.",
};
// Shortcuts into search; they only prefill the query.
const categories = [
  { name: "Хумс", icon: Paintbrush, tone: "rose" },
  { name: "Үс", icon: Scissors, tone: "violet" },
  { name: "Сормуус", icon: Eye, tone: "sky" },
  { name: "Арьс арчилгаа", icon: Droplets, tone: "sage" },
  { name: "Массаж", icon: Hand, tone: "sand" },
  { name: "Спа", icon: Flower2, tone: "lilac" },
];
const trust = [
  "Бүртгэл шаардлагагүй",
  "Сул цаг шууд харагдана",
  "Цагаа өөрөө өөрчилж, цуцална",
];
const steps = [
  {
    icon: Store,
    title: "Салоноо сонго",
    text: "Нэр, үйлчилгээ эсвэл дүүргээр хайж өөрт таарах салоноо ол.",
  },
  {
    icon: MousePointerClick,
    title: "Цагаа сонго",
    text: "Үйлчилгээ, ажилтан, сул цагаа хараад хэдхэн товшилтоор захиал.",
  },
  {
    icon: CalendarCheck,
    title: "Баталгаажуулалт ав",
    text: "Бүртгэл, апп шаардлагагүй. Цагаа линкээрээ өөрчилж, цуцалж болно.",
  },
];
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
    : {
        ...input,
        total: 0,
        pageSize: 24,
        districts: [],
        stats: { salons: 0, services: 0, bookingsToday: 0 },
        popular: [],
        salons: [],
      };
  const filtered = Boolean(data.query || data.district);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const link = (page: number) =>
    `/?${new URLSearchParams({ query: data.query, district: data.district, page: String(page) })}`;
  const stats = [
    data.stats.salons > 0 && `${data.stats.salons} салон`,
    data.stats.services > 0 && `${data.stats.services} үйлчилгээ`,
    data.stats.bookingsToday > 0 &&
      `өнөөдөр ${data.stats.bookingsToday} захиалга`,
  ].filter(Boolean);
  return (
    <div className="lp hp">
      <div className="hp-glow" aria-hidden="true" />
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
            Бизнесээ бүртгүүлэх
          </Link>
        </div>
      </header>
      <main>
        <section className="hp-hero">
          <span className="lp-pill">
            <Sparkles size={13} /> Хумс, үс, сормуус, арьс арчилгаа
          </span>
          <h1>
            Гоо сайхны цагаа
            <br />
            <em>хэдхэн товшилтоор</em> захиал
          </h1>
          <p>
            Салоноо сонгоод сул цагийг нь шууд хараарай. Залгаж, мессеж бичиж
            хүлээх шаардлагагүй.
          </p>
          <form className="hp-search" method="get" action="/" role="search">
            <label>
              <Search size={19} />
              <input
                type="search"
                name="query"
                defaultValue={data.query}
                placeholder="Салон эсвэл үйлчилгээ"
                aria-label="Салон эсвэл үйлчилгээ хайх"
              />
            </label>
            <label>
              <MapPin size={19} />
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
          {data.popular.length > 0 && (
            <nav className="hp-popular" aria-label="Түгээмэл ангилал">
              <span>Түгээмэл:</span>
              {data.popular.map((name) => (
                <Link
                  key={name}
                  href={`/?${new URLSearchParams({ query: name })}`}
                  aria-current={data.query === name ? "true" : undefined}
                >
                  {name}
                </Link>
              ))}
            </nav>
          )}
          {stats.length > 0 && <p className="hp-stats">{stats.join(" · ")}</p>}
          <ul className="hp-trust">
            {trust.map((t) => (
              <li key={t}>
                <BadgeCheck size={15} /> {t}
              </li>
            ))}
          </ul>
        </section>
        <nav className="hp-cats" aria-label="Үйлчилгээний төрөл">
          {categories.map((c) => (
            <Link
              key={c.name}
              href={`/?${new URLSearchParams({ query: c.name })}`}
              className={`tone-${c.tone}`}
              aria-current={data.query === c.name ? "true" : undefined}
            >
              <span>
                <c.icon size={22} />
              </span>
              {c.name}
            </Link>
          ))}
        </nav>
        <section className="hp-results" aria-labelledby="hp-title">
          <div className="hp-results-head">
            <div>
              <h2 id="hp-title">
                {filtered ? "Хайлтын үр дүн" : "Салонууд"}
                <span>{data.total}</span>
              </h2>
              <p>
                {filtered
                  ? [data.query && `«${data.query}»`, data.district]
                      .filter(Boolean)
                      .join(" · ")
                  : "Онлайнаар цаг авч буй салонууд"}
              </p>
            </div>
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
                    <div className={`hp-cover tone-${tone(s.slug)}`}>
                      {s.coverUrl ? (
                        <Image
                          src={s.coverUrl}
                          alt=""
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, 380px"
                        />
                      ) : (
                        <span aria-hidden="true">{initials(s.name)}</span>
                      )}
                      <div className="hp-badges">
                        {s.isNew && <em className="hp-new">Шинэ</em>}
                        {s.hasDiscount && (
                          <em className="hp-sale">
                            <Tag size={12} /> Хямдралтай
                          </em>
                        )}
                      </div>
                      {s.photos > 1 && (
                        <span className="hp-photos">
                          <Images size={12} /> {s.photos}
                        </span>
                      )}
                      {s.district && (
                        <span className="hp-district">
                          <MapPin size={12} /> {s.district}
                        </span>
                      )}
                    </div>
                    <div className="hp-body">
                      <h3>{s.name}</h3>
                      {s.address && <p className="hp-place">{s.address}</p>}
                      {s.categories.length > 0 && (
                        <ul className="hp-tags">
                          {s.categories.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      )}
                      <div className="hp-foot">
                        <div>
                          {s.fromMnt > 0 && <b>{formatMnt(s.fromMnt)}-с</b>}
                          <span>{s.services} үйлчилгээ</span>
                        </div>
                        <span className="hp-book">
                          Цаг захиалах <ArrowRight size={15} />
                        </span>
                      </div>
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
                  <Link href="/" className="lp-btn small outline">
                    Бүх салоныг харах
                  </Link>
                </>
              ) : (
                <>
                  <h3>Удахгүй энд салонууд нэмэгдэнэ</h3>
                  <p>
                    Салон эзэмшдэг бол одоо бүртгүүлж эхний эгнээнд харагдаарай.
                  </p>
                  <Link href="/business" className="lp-btn small">
                    Бизнесээ бүртгүүлэх
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
        <section className="hp-how" aria-labelledby="hp-how-title">
          <h2 id="hp-how-title">Хэрхэн захиалах вэ</h2>
          <ol>
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="hp-how-icon">
                  <s.icon size={20} />
                </span>
                <small>{i + 1}-р алхам</small>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="hp-owner">
          <div>
            <span className="hp-owner-tag">Салон эзэмшигчдэд</span>
            <h2>Салоноо энд үнэгүй байршуулаарай</h2>
            <p>
              Онлайн захиалга, календарь, ажилтан, тайлангаа нэг дороос удирдаж,
              шинэ үйлчлүүлэгчдэд харагдаарай.
            </p>
          </div>
          <Link href="/business" className="lp-btn light">
            Бизнесээ бүртгүүлэх <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="hp-footer">
        <div>
          <Link href="/" className="lp-logo" aria-label="Salon77 нүүр">
            <span className="lp-logo-mark">s</span>
            salon77<span className="lp-dot">.</span>
          </Link>
          <p>Гоо сайхны салонд цагаа онлайнаар захиалах хялбар арга.</p>
        </div>
        <nav aria-label="Үйлчлүүлэгчдэд">
          <strong>Үйлчлүүлэгчдэд</strong>
          <Link href="/">Салон хайх</Link>
          <a href="#hp-how-title">Хэрхэн захиалах вэ</a>
        </nav>
        <nav aria-label="Салон эзэмшигчдэд">
          <strong>Салон эзэмшигчдэд</strong>
          <Link href="/business">Бизнесээ бүртгүүлэх</Link>
          <Link href="/sign-in">Нэвтрэх</Link>
        </nav>
        {site.phone && (
          <div>
            <strong>Холбоо барих</strong>
            <a href={`tel:${site.phone}`}>{formatSitePhone(site.phone)}</a>
          </div>
        )}
        <small>© {new Date().getFullYear()} Salon77</small>
      </footer>
    </div>
  );
}
