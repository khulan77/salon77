import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import "@fontsource-variable/source-serif-4";
import "../home.css";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock3,
  Droplets,
  Eye,
  Flower2,
  Hand,
  MapPin,
  Navigation,
  Paintbrush,
  Palette,
  RefreshCcw,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import {
  directoryQuery,
  listDirectory,
  type Directory,
} from "@/lib/services/directory";
import { formatDuration, formatMnt } from "@/lib/ui-language";
import { HomeFooter } from "@/components/home-footer";
import { initials, tone } from "@/lib/avatar";
import { optimizable } from "@/lib/image";
import { TRIAL_DAYS } from "@/lib/billing";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salon77 · Гоо сайхны салонд онлайнаар цаг захиалах",
  description:
    "Улаанбаатарын баталгаажсан гоо сайхны салонуудаас сонгоод цагаа онлайнаар захиалаарай: үс, хумс, сормуус, арьс арчилгаа, массаж.",
};
// Search, filters and paging stay on the directory even while "/" shows the
// business page (see app/landing).
const DIRECTORY = "/home";
// Shortcuts shown before any salon lists a category of its own.
const fallbackCategories = [
  "Үс засалт",
  "Хумс",
  "Арьс арчилгаа",
  "Сормуус",
  "Массаж",
  "Нүүр будалт",
  "Эрэгтэй засалт",
];
// The icon for a category, by the words in its name.
function categoryIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/хумс|маникюр|педикюр/.test(n)) return Paintbrush;
  if (/сормуус|хөмсөг/.test(n)) return Eye;
  if (/арьс|нүүр арчилгаа|спа|facial/.test(n)) return Droplets;
  if (/массаж|алжаал/.test(n)) return Hand;
  if (/будалт|make|гоо сайхан/.test(n)) return Palette;
  if (/үс|барбер|эрэгтэй/.test(n)) return Scissors;
  return Flower2;
}
const promises = [
  {
    icon: UserRound,
    title: "Бүртгэлгүй захиалга",
    text: "Нэвтрэх, апп татах шаардлагагүй. Нэр, утсаараа цагаа баталгаажуулна.",
  },
  {
    icon: ShieldCheck,
    title: "Баталгаажсан салонууд",
    text: "Salon77 салон бүрийг хянаж баталгаажуулсны дараа жагсаалтад гаргана.",
  },
  {
    icon: CalendarCheck,
    title: "Бодит сул цаг",
    text: "Ажилтан бүрийн хуваариас сул цагийг шууд харж, сонгоно.",
  },
  {
    icon: RefreshCcw,
    title: "Цагаа өөрөө өөрчилнө",
    text: "Захиалгын линкээрээ цагаа өөрчилж, цуцлах боломжтой.",
  },
];
const filters = [
  { key: "", label: "Бүх салон" },
  { key: "discount", label: "Хямдралтай" },
  { key: "new", label: "Шинэ" },
] as const;
const emptyDirectory = (
  input: ReturnType<typeof directoryQuery.parse>,
): Directory => ({
  ...input,
  total: 0,
  pageSize: 24,
  districts: [],
  stats: { salons: 0, services: 0, bookingsToday: 0 },
  categories: [],
  areas: [],
  popular: [],
  salons: [],
});
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
    filter: q.filter ?? "",
  });
  const input = parsed.success ? parsed.data : directoryQuery.parse({});
  const data = configured
    ? await listDirectory(db, input)
    : emptyDirectory(input);
  const filtered = Boolean(data.query || data.district || data.filter);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const url = (params: Record<string, string>, hash = "") => {
    const search = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v),
    ).toString();
    return `${DIRECTORY}${search ? `?${search}` : ""}${hash}`;
  };
  const page = (n: number) =>
    url({
      query: data.query,
      district: data.district,
      filter: data.filter,
      page: n ? String(n) : "",
    });
  // Real categories first; common shortcuts fill the row while there are few.
  const categories = [
    ...data.categories,
    ...fallbackCategories
      .filter(
        (name) =>
          !data.categories.some((c) =>
            c.name.toLowerCase().includes(name.toLowerCase().slice(0, 4)),
          ),
      )
      .map((name) => ({ name, salons: 0 })),
  ].slice(0, 7);
  return (
    <div className="hx" id="top">
      <header className="hx-nav">
        <Link href="/" className="hx-logo" aria-label="Salon77 нүүр хуудас">
          <Image
            src="/salon77-mn-logo.png"
            alt="Salon77.mn"
            width={792}
            height={198}
            priority
          />
        </Link>
        <form
          className="hx-nav-search"
          method="get"
          action={DIRECTORY}
          role="search"
        >
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            name="query"
            defaultValue={data.query}
            placeholder="Үйлчилгээ, салон, мастер хайх"
            aria-label="Үйлчилгээ, салон хайх"
          />
        </form>
        <details className="hx-city">
          <summary>
            <Navigation size={15} />
            {data.district || "Улаанбаатар"}
            <ChevronDown size={15} className="hx-city-caret" />
          </summary>
          <nav aria-label="Дүүрэг сонгох">
            <Link
              href={url({ query: data.query }, "#salons")}
              aria-current={!data.district ? "true" : undefined}
            >
              Бүх дүүрэг
            </Link>
            {data.districts.map((d) => (
              <Link
                key={d}
                href={url({ query: data.query, district: d }, "#salons")}
                aria-current={data.district === d ? "true" : undefined}
              >
                {d}
              </Link>
            ))}
          </nav>
        </details>
        <div className="hx-nav-actions">
          <Link href="/business" className="hx-pill">
            <Store size={16} /> Бизнесээ бүртгүүлэх
          </Link>
          <Link
            href="/sign-in"
            className="hx-square"
            aria-label="Мэдэгдэл: нэвтэрч харна"
          >
            <Bell size={18} />
          </Link>
          <Link href="/sign-in" className="hx-square dark" aria-label="Нэвтрэх">
            <UserRound size={18} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hx-hero" aria-labelledby="hx-hero-title">
          <span className="hx-eyebrow-pill">
            <Sparkles size={12} /> Улаанбаатарын гоо сайхны салонууд нэг дор
          </span>
          <h1 id="hx-hero-title">Гоо сайхны цагаа хэдхэн товшилтоор захиал</h1>
          <p>
            Залгаж, мессеж бичиж хүлээх шаардлагагүй. Баталгаажсан салонуудын
            бодит сул цагийг хараад шууд захиалаарай.
          </p>
          <form
            className="hx-search"
            method="get"
            action={`${DIRECTORY}#salons`}
            role="search"
          >
            <label className="hx-field">
              <Scissors size={18} aria-hidden="true" />
              <span>
                <small>Үйлчилгээ, салон</small>
                <input
                  type="search"
                  name="query"
                  defaultValue={data.query}
                  placeholder="Хумс, үс засалт, салоны нэр…"
                />
              </span>
            </label>
            <label className="hx-field">
              <MapPin size={18} aria-hidden="true" />
              <span>
                <small>Байршил</small>
                <select name="district" defaultValue={data.district}>
                  <option value="">Бүх дүүрэг</option>
                  {data.districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <button type="submit" className="hx-btn">
              <Search size={16} /> Хайх
            </button>
          </form>
          {data.popular.length > 0 && (
            <nav className="hx-popular" aria-label="Түгээмэл ангилал">
              <span>Түгээмэл:</span>
              {data.popular.slice(0, 6).map((name) => (
                <Link
                  key={name}
                  href={url({ query: name }, "#salons")}
                  aria-current={data.query === name ? "true" : undefined}
                >
                  {name}
                </Link>
              ))}
            </nav>
          )}
        </section>
        <section className="hx-section" aria-labelledby="hx-cats-title">
          <div className="hx-head">
            <div>
              <span className="hx-eyebrow">Төрлүүд</span>
              <h2 id="hx-cats-title">Үйлчилгээний ангилал</h2>
            </div>
          </div>
          <nav className="hx-cats" aria-label="Үйлчилгээний ангилал">
            {categories.map((c) => {
              const Icon = categoryIcon(c.name);
              return (
                <Link
                  key={c.name}
                  href={url({ query: c.name }, "#salons")}
                  aria-current={data.query === c.name ? "true" : undefined}
                >
                  <span className="hx-cat-icon">
                    <Icon size={20} strokeWidth={1.6} />
                  </span>
                  <strong>{c.name}</strong>
                  {c.salons > 0 && <small>{c.salons} салон</small>}
                </Link>
              );
            })}
          </nav>
        </section>
        <section
          id="salons"
          className="hx-section"
          aria-labelledby="hx-salons-title"
        >
          <div className="hx-head">
            <div>
              <span className="hx-eyebrow">
                Баталгаажсан салонууд · Онлайн захиалга
              </span>
              <h2 id="hx-salons-title">
                {data.query || data.district
                  ? "Хайлтын үр дүн"
                  : "Шилдэг салонууд"}
                <span className="hx-count">{data.total}</span>
              </h2>
              {(data.query || data.district) && (
                <p className="hx-sub">
                  {[data.query && `«${data.query}»`, data.district]
                    .filter(Boolean)
                    .join(" · ")}
                  {" · "}
                  <Link href={url({}, "#salons")}>Шүүлтүүр арилгах</Link>
                </p>
              )}
            </div>
            <nav className="hx-tabs" aria-label="Салон шүүх">
              {filters.map((f) => (
                <Link
                  key={f.key}
                  href={url(
                    {
                      query: data.query,
                      district: data.district,
                      filter: f.key,
                    },
                    "#salons",
                  )}
                  aria-current={data.filter === f.key ? "true" : undefined}
                >
                  {f.label}
                </Link>
              ))}
            </nav>
          </div>
          {data.salons.length ? (
            <ul className="hx-grid">
              {data.salons.map((s) => (
                <li key={s.slug}>
                  <SalonCard salon={s} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="hx-empty">
              {filtered ? (
                <>
                  <h3>Тохирох салон олдсонгүй</h3>
                  <p>Өөр нэр, үйлчилгээ эсвэл дүүргээр хайгаад үзээрэй.</p>
                  <Link href={url({}, "#salons")} className="hx-btn outline">
                    Бүх салоныг харах
                  </Link>
                </>
              ) : (
                <>
                  <h3>Удахгүй энд салонууд нэмэгдэнэ</h3>
                  <p>
                    Салон эзэмшдэг бол одоо бүртгүүлж эхний эгнээнд харагдаарай.
                  </p>
                  <Link href="/business" className="hx-btn">
                    Бизнесээ бүртгүүлэх
                  </Link>
                </>
              )}
            </div>
          )}
          {pages > 1 && (
            <nav className="hx-pager" aria-label="Хуудаслалт">
              {data.page > 0 && <Link href={page(data.page - 1)}>Өмнөх</Link>}
              <span>
                {data.page + 1} / {pages}
              </span>
              {data.page + 1 < pages && (
                <Link href={page(data.page + 1)}>Дараах</Link>
              )}
            </nav>
          )}
        </section>
        {data.areas.length > 0 && (
          <section
            className="hx-section hx-near"
            aria-labelledby="hx-near-title"
          >
            <div className="hx-near-copy">
              <span className="hx-eyebrow">
                <Navigation size={12} /> Байршлаар хайх
              </span>
              <h2 id="hx-near-title">Таны ойролцоох гоо сайхны салонууд</h2>
              <p className="hx-sub">
                Дүүргээ сонгоод хамгийн ойр байрлах салоноо олоорой.
              </p>
              <ol className="hx-areas">
                {data.areas.slice(0, 4).map((a, i) => (
                  <li key={a.name}>
                    <Link href={url({ district: a.name }, "#salons")}>
                      <span className="hx-area-no">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{a.name}</strong>
                        <small>{a.salons} салон</small>
                      </span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
            <div className="hx-map">
              <iframe
                title="Улаанбаатарын газрын зураг"
                src="https://www.openstreetmap.org/export/embed.html?bbox=106.78%2C47.86%2C107.06%2C47.97&layer=mapnik"
                loading="lazy"
              />
              <div className="hx-map-card">
                <span>
                  <MapPin size={16} />
                </span>
                <div>
                  <strong>{data.stats.salons} баталгаажсан салон</strong>
                  <small>Улаанбаатар хотод онлайнаар цаг авч байна</small>
                </div>
              </div>
            </div>
          </section>
        )}
        <section
          className="hx-section hx-promise"
          aria-labelledby="hx-promise-title"
        >
          <div className="hx-center">
            <span className="hx-eyebrow">Хэрэглэгчийн давуу тал</span>
            <h2 id="hx-promise-title">Амар тайван, найдвартай захиалга</h2>
            <p className="hx-sub">
              Цагаа хэдхэн алхмаар захиалж, хүссэн үедээ өөрчлөх боломжтой.
            </p>
          </div>
          <ol className="hx-promises">
            {promises.map((p, i) => (
              <li key={p.title}>
                <span className="hx-promise-icon">
                  <p.icon size={18} strokeWidth={1.7} />
                </span>
                <small>{String(i + 1).padStart(2, "0")}</small>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="hx-cta" aria-labelledby="hx-cta-title">
          <div>
            <span className="hx-cta-tag">
              Salon77 · Салоны удирдлагын систем
            </span>
            <h2 id="hx-cta-title">Та салон эсвэл бие даасан мастер уу?</h2>
            <p>
              Онлайн захиалга, календарь, ажилтан, орлогын тайлангаа нэг дороос
              удирдаарай. Эхний {TRIAL_DAYS} хоног үнэгүй.
            </p>
            <ul>
              <li>
                <Check size={14} /> Онлайн захиалга 24 цагаар
              </li>
              <li>
                <Check size={14} /> Календарь, ажилтан, ажлын цаг
              </li>
              <li>
                <Check size={14} /> Орлогын тайлан
              </li>
            </ul>
          </div>
          <div className="hx-cta-actions">
            <Link href="/business" className="hx-btn gold">
              Бизнесээ бүртгүүлэх <ArrowRight size={16} />
            </Link>
            <Link href="/sign-in" className="hx-btn ghost">
              Бүртгэлтэй юу? Нэвтрэх
            </Link>
          </div>
        </section>
      </main>
      <HomeFooter categories={categories.map((c) => c.name).slice(0, 5)} />
    </div>
  );
}
function SalonCard({ salon: s }: { salon: Directory["salons"][number] }) {
  return (
    <article className="hx-card">
      <Link
        href={`/${s.slug}/book`}
        className={`hx-cover tone-${tone(s.slug)}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {s.coverUrl ? (
          <Image
            src={s.coverUrl}
            alt=""
            fill
            unoptimized={!optimizable(s.coverUrl)}
            sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 300px"
          />
        ) : (
          <span className="hx-initials">{initials(s.name)}</span>
        )}
        {(s.isNew || s.hasDiscount) && (
          <em className="hx-badge">{s.hasDiscount ? "Хямдралтай" : "Шинэ"}</em>
        )}
        {s.hours && (
          <span className="hx-hours">
            <Clock3 size={12} /> Өнөөдөр {s.hours}
          </span>
        )}
      </Link>
      <div className="hx-card-body">
        <div className="hx-card-meta">
          {s.rating ? (
            <span className="hx-rating">
              <Star size={13} /> {s.rating.average.toFixed(1)}
              <small>({s.rating.count} үнэлгээ)</small>
            </span>
          ) : (
            <span className="hx-rating muted">
              <BadgeCheck size={13} /> Баталгаажсан
            </span>
          )}
          {s.district && (
            <span className="hx-district">
              {[s.district, s.branches > 1 && `${s.branches} салбар`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
        <h3>
          <Link href={`/${s.slug}/book`}>{s.name}</Link>
        </h3>
        {s.categories.length > 0 && (
          <p className="hx-card-cats">{s.categories.join(" · ")}</p>
        )}
        {s.top.length > 0 && (
          <ul className="hx-services">
            {s.top.map((v) => (
              <li key={v.name}>
                <span>
                  <strong>{v.name}</strong>
                  <small>{formatDuration(v.durationMinutes)}</small>
                </span>
                <b>
                  {v.listPriceMnt > v.priceMnt && (
                    <s>{formatMnt(v.listPriceMnt)}</s>
                  )}
                  {formatMnt(v.priceMnt)}
                </b>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/${s.slug}/book`} className="hx-btn block">
          Цаг захиалах <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  );
}
