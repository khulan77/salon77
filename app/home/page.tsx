import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  Droplets,
  Eye,
  Flower2,
  Hand,
  Images,
  MapPin,
  MousePointerClick,
  Paintbrush,
  Scissors,
  Search,
  Sparkles,
  Star,
  Store,
  Tag,
} from "lucide-react";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { directoryQuery, listDirectory } from "@/lib/services/directory";
import { formatMnt } from "@/lib/ui-language";
import { initials, tone } from "@/lib/avatar";
import { optimizable } from "@/lib/image";
import { TRIAL_DAYS } from "@/lib/billing";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salon77 · Гоо сайхны салонд онлайнаар цаг захиалах",
  description:
    "Хумс, үс, сормуус, арьс арчилгааны салонуудаас сонгоод цагаа онлайнаар захиалаарай.",
};
// Shortcuts into search; they only prefill the query.
const categories = [
  { name: "Хумс", icon: Paintbrush },
  { name: "Үс", icon: Scissors },
  { name: "Сормуус", icon: Eye },
  { name: "Арьс арчилгаа", icon: Droplets },
  { name: "Массаж", icon: Hand },
  { name: "Спа", icon: Flower2 },
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
const ownerPoints = [
  "Онлайн захиалга 24 цагийн турш",
  "Календарь, ажилтан, ажлын цаг",
  "Орлогын тайлан, үйлчлүүлэгчийн түүх",
];
// Search, filters and paging stay on the directory even while "/" shows the
// business page (see app/landing).
const DIRECTORY = "/home";
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
    `${DIRECTORY}?${new URLSearchParams({ query: data.query, district: data.district, page: String(page) })}`;
  const search = (query: string) =>
    `${DIRECTORY}?${new URLSearchParams({ query })}#salons`;
  const stats = [
    data.stats.salons > 0 && `${data.stats.salons} салон`,
    data.stats.services > 0 && `${data.stats.services} үйлчилгээ`,
    data.stats.bookingsToday > 0 &&
      `өнөөдөр ${data.stats.bookingsToday} захиалга`,
  ].filter(Boolean);
  return (
    <div className="hp">
      <header className="hp-nav">
        <Logo href="/" />
        <nav aria-label="Хуудасны хэсгүүд">
          <a href="#salons">Салонууд</a>
          <a href="#how">Хэрхэн захиалах вэ</a>
          <Link href="/business">Салонуудад</Link>
        </nav>
        <div className="hp-nav-actions">
          <Link href="/sign-in" className="hp-signin">
            Нэвтрэх
          </Link>
          <Link href="/business" className="hp-btn small">
            Бизнесээ бүртгүүлэх
          </Link>
        </div>
      </header>
      <main>
        <section className="hp-hero">
          <div className="hp-hero-copy">
            <span className="hp-pill">
              <Sparkles size={13} /> Хумс, үс, сормуус, арьс арчилгаа
            </span>
            <h1>
              Гоо сайхны цагаа <em>хэдхэн товшилтоор</em> захиал
            </h1>
            <p>
              Салоноо сонгоод сул цагийг нь шууд хараарай. Залгаж, мессеж бичиж
              хүлээх шаардлагагүй.
            </p>
            <form
              className="hp-search"
              method="get"
              action={DIRECTORY}
              role="search"
            >
              <label className="hp-search-query">
                <Search size={18} />
                <input
                  type="search"
                  name="query"
                  defaultValue={data.query}
                  placeholder="Салон эсвэл үйлчилгээ"
                  aria-label="Салон эсвэл үйлчилгээ хайх"
                />
              </label>
              <label className="hp-search-district">
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
              <button type="submit">
                <Search size={17} />
                Хайх
              </button>
            </form>
            {data.popular.length > 0 && (
              <nav className="hp-popular" aria-label="Түгээмэл ангилал">
                <span>Түгээмэл:</span>
                {data.popular.map((name) => (
                  <Link
                    key={name}
                    href={search(name)}
                    aria-current={data.query === name ? "true" : undefined}
                  >
                    {name}
                  </Link>
                ))}
              </nav>
            )}
            <ul className="hp-trust">
              {trust.map((t) => (
                <li key={t}>
                  <BadgeCheck size={15} /> {t}
                </li>
              ))}
            </ul>
            {stats.length > 0 && (
              <p className="hp-stats">{stats.join(" · ")}</p>
            )}
          </div>
          <HeroArt />
        </section>
        <section className="hp-section" aria-labelledby="hp-cats-title">
          <div className="hp-head">
            <h2 id="hp-cats-title">Ангиллаар хайх</h2>
          </div>
          <nav className="hp-cats" aria-label="Үйлчилгээний төрөл">
            {categories.map((c) => (
              <Link
                key={c.name}
                href={search(c.name)}
                aria-current={data.query === c.name ? "true" : undefined}
              >
                <span>
                  <c.icon size={22} />
                </span>
                {c.name}
              </Link>
            ))}
          </nav>
        </section>
        <section id="salons" className="hp-section" aria-labelledby="hp-title">
          <div className="hp-head">
            <div>
              <h2 id="hp-title">
                {filtered ? "Хайлтын үр дүн" : "Онцлох салонууд"}
                <span className="hp-count">{data.total}</span>
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
              <Link href={DIRECTORY} className="hp-link">
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
                          unoptimized={!optimizable(s.coverUrl)}
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
                    </div>
                    <div className="hp-body">
                      <h3>{s.name}</h3>
                      {(s.district || s.branches > 1) && (
                        <p className="hp-place">
                          <MapPin size={13} />
                          {[
                            s.district,
                            s.branches > 1 && `${s.branches} салбар`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
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
                  <Link href={DIRECTORY} className="hp-btn outline small">
                    Бүх салоныг харах
                  </Link>
                </>
              ) : (
                <>
                  <h3>Удахгүй энд салонууд нэмэгдэнэ</h3>
                  <p>
                    Салон эзэмшдэг бол одоо бүртгүүлж эхний эгнээнд харагдаарай.
                  </p>
                  <Link href="/business" className="hp-btn small">
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
        <section id="how" className="hp-section" aria-labelledby="hp-how-title">
          <div className="hp-head">
            <h2 id="hp-how-title">Хэрхэн захиалах вэ</h2>
          </div>
          <ol className="hp-steps">
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="hp-step-icon">
                  <s.icon size={20} />
                </span>
                <small>{i + 1}-р алхам</small>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="hp-owner" aria-labelledby="hp-owner-title">
          <div>
            <span className="hp-owner-tag">Салон эзэмшигчдэд</span>
            <h2 id="hp-owner-title">Салоноо онлайн захиалгатай болгоорой</h2>
            <p>
              Шинэ үйлчлүүлэгчдэд харагдаж, захиалга, ажилтан, орлогоо нэг
              дороос удирдаарай. Эхний {TRIAL_DAYS} хоног үнэгүй.
            </p>
            <ul>
              {ownerPoints.map((p) => (
                <li key={p}>
                  <Check size={15} strokeWidth={2.5} /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="hp-owner-actions">
            <Link href="/business" className="hp-btn light">
              Бизнесээ бүртгүүлэх <ArrowRight size={16} />
            </Link>
            <Link href="/sign-in" className="hp-owner-signin">
              Бүртгэлтэй юу? Нэвтрэх
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
// Illustration of the booking flow; decorative, the copy carries the meaning.
function HeroArt() {
  return (
    <div className="hp-art" aria-hidden="true">
      <div className="hp-art-card">
        <div className="hp-art-cover">
          <span>Хумс · Сормуус</span>
        </div>
        <div className="hp-art-body">
          <strong>Таны дуртай салон</strong>
          <span className="hp-art-rating">
            <Star size={12} /> 4.9 · Сүхбаатар
          </span>
          <small>Маргааш, сул цаг</small>
          <div className="hp-art-times">
            {["10:00", "11:30", "14:00", "15:30", "17:00", "18:30"].map(
              (t, i) => (
                <i key={t} className={i === 2 ? "on" : ""}>
                  {t}
                </i>
              ),
            )}
          </div>
          <em>Цаг захиалах</em>
        </div>
      </div>
      <div className="hp-art-toast">
        <CalendarCheck size={16} />
        <div>
          <strong>Захиалга баталгаажлаа</strong>
          <span>Маргааш 14:00 · Гел будалт</span>
        </div>
      </div>
    </div>
  );
}
