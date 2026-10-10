import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  AtSign,
  BellRing,
  Boxes,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ClipboardCheck,
  History,
  Link2,
  MessageSquare,
  Phone,
  ShieldCheck,
  Scissors,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { identity } from "@/lib/auth";
import { site, formatSitePhone } from "@/lib/site";
import { formatMnt } from "@/lib/ui-language";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salon77 · Салоны цаг захиалга, удирдлагын систем",
  description:
    "Салоноо онлайн захиалгатай болгоод календарь, ажилтан, урьдчилгаа, тайлангаа нэг дороос удирдаарай.",
};
const groups = [
  {
    icon: Link2,
    title: "Онлайн захиалгын систем",
    text: "Салон бүр өөрийн захиалгын линктэй. Үйлчлүүлэгч утаснаасаа 24 цагийн турш цаг авна.",
    items: [
      "Үйлчлүүлэгч бүртгүүлэх, апп суулгах шаардлагагүй",
      "Ажилтан, өдөр, сул цагаа өөрөө сонгоно",
      "2 үйлчилгээг 2 ажилтан зэрэг хийх захиалга",
      "Урьдчилгааг хувиар эсвэл тогтмол дүнгээр авах",
      "Хямдралтай үнэ шууд харагдана",
    ],
  },
  {
    icon: CalendarCheck,
    title: "Салоны бүрэн удирдлага",
    text: "Өдөр тутмын ажил бүгд нэг дор, компьютер болон утсан дээр.",
    items: [
      "Календарь: өдөр, долоо хоногоор, салбар, ажилтнаар",
      "Үйлчлүүлэгчийн бүртгэл, үйлчилгээний түүх",
      "Үйлчилгээ, үнэ, хугацаа, ангилал",
      "Ажилтан, ажлын цаг, цагийн бүртгэл",
      "Орлогын тайлан: өдөр, сар, үйлчилгээ, ажилтнаар",
    ],
  },
  {
    icon: Users,
    title: "Баг ба эрх",
    text: "Хүн бүр зөвхөн өөрт хэрэгтэй хэсгээ харна.",
    items: [
      "Эзэмшигч, менежер, ресепшн, ажилтан гэсэн эрх",
      "Хариуцсан салбараар хязгаарлах",
      "Олон салбартай салонд тохиромжтой",
      "Хэн хэзээ нэвтэрснийг харах",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Найдвартай, аюулгүй",
    text: "Захиалгын алдаа, хуурамч захиалгаас хамгаална.",
    items: [
      "Нэг ажилтанд нэг цагт давхар захиалга орохгүй",
      "Хуурамч, олон дахин захиалгаас хамгаалалт",
      "Баталгаажаагүй захиалгыг автоматаар цуцлах",
      "Салон бүрийн мэдээлэл тусдаа хамгаалагдсан",
    ],
  },
];
const steps = [
  [
    "Бүртгүүлэх",
    "Имэйлээрээ бүртгүүлээд салоныхоо мэдээллийг илгээнэ. Бид шалгаад баталгаажуулна.",
  ],
  ["Тохируулах", "Үйлчилгээ, үнэ, ажилтан, ажлын цагаа нэмнэ. Хэдхэн минут."],
  [
    "Линкээ хуваалцах",
    "Захиалгын линкээ Инстаграм, Фэйсбүүк хуудсандаа тавиад захиалга аваад эхэлнэ.",
  ],
];
const faq = [
  [
    "Бүртгүүлэхэд төлбөртэй юу?",
    "Бүртгүүлэх, ашиглаж эхлэх нь үнэгүй. Төлбөрийн багцын мэдээллийг удахгүй зарлах бөгөөд өмнө нь заавал мэдэгдэнэ.",
  ],
  [
    "Үйлчлүүлэгч маань апп суулгах уу?",
    "Үгүй. Үйлчлүүлэгч линкээр орж утаснаасаа шууд цаг захиална. Бүртгүүлэх, нууц үг үүсгэх шаардлагагүй.",
  ],
  [
    "Утаснаасаа удирдаж болох уу?",
    "Тийм. Календарь, захиалга, үйлчлүүлэгч, тайлан бүгд утсан дээр ажиллахаар хийгдсэн.",
  ],
  [
    "Нэг цагт хоёр хүн давхар захиалчихвал яах вэ?",
    "Систем ийм тохиолдлыг өөрөө хаана. Нэгэнт захиалагдсан цагийг дараагийн хүн сонгох боломжгүй.",
  ],
  [
    "Миний мэдээлэл аюулгүй юу?",
    "Салон бүрийн мэдээлэл тусдаа хамгаалагдсан. Танай ажилтан, үйлчлүүлэгчийн мэдээллийг өөр салон хэзээ ч харахгүй.",
  ],
];
const calendar = [
  {
    col: 0,
    top: 0,
    h: 2,
    name: "Сараа Б.",
    what: "Гел будалт",
    price: 65_000,
    tone: "violet",
    done: true,
    regular: true,
  },
  {
    col: 1,
    top: 1,
    h: 3,
    name: "Номин Д.",
    what: "Маникюр, педикюр",
    price: 100_000,
    tone: "rose",
  },
  {
    col: 2,
    top: 0,
    h: 2,
    name: "Ану Т.",
    what: "Сормуус",
    price: 80_000,
    tone: "sage",
    done: true,
  },
  {
    col: 0,
    top: 3,
    h: 2,
    name: "Оюун Г.",
    what: "Үс засалт",
    price: 45_000,
    tone: "sky",
    regular: true,
  },
  {
    col: 2,
    top: 2,
    h: 2,
    name: "Болор Э.",
    what: "Нүүр арчилгаа",
    price: 90_000,
    tone: "sand",
  },
];
// Illustrative figures for the product showcase; the rows add up to the total.
const revenueBars = [38, 52, 44, 61, 70, 48, 83, 66, 58, 74, 92, 64, 79, 100];
const byService = [
  { name: "Гел будалт", count: 68, revenue: 3_920_000, tone: "violet" },
  { name: "Үс засалт, будалт", count: 41, revenue: 3_280_000, tone: "rose" },
  { name: "Маникюр, педикюр", count: 52, revenue: 2_470_000, tone: "sky" },
  { name: "Сормуус", count: 29, revenue: 1_740_000, tone: "sage" },
  { name: "Нүүр арчилгаа", count: 24, revenue: 1_070_000, tone: "sand" },
];
const byStaff = [
  { name: "Ану", count: 81, revenue: 4_860_000 },
  { name: "Болор", count: 72, revenue: 4_120_000 },
  { name: "Сувд", count: 61, revenue: 3_500_000 },
];
const showcaseRevenue = byService.reduce((sum, s) => sum + s.revenue, 0);
const showcaseCount = byService.reduce((sum, s) => sum + s.count, 0);
const week = [
  {
    day: "Да",
    date: 5,
    events: [
      ["10:00", "violet"],
      ["13:30", "sky"],
    ],
  },
  { day: "Мя", date: 6, events: [["11:00", "rose"]] },
  {
    day: "Лх",
    date: 7,
    events: [
      ["09:30", "sage"],
      ["12:00", "violet"],
      ["15:00", "sand"],
    ],
  },
  {
    day: "Пү",
    date: 8,
    events: [
      ["10:30", "sky"],
      ["14:00", "rose"],
    ],
  },
  {
    day: "Ба",
    date: 9,
    events: [
      ["10:00", "violet"],
      ["11:30", "sage"],
      ["16:00", "rose"],
    ],
  },
  {
    day: "Бя",
    date: 10,
    events: [
      ["10:00", "sand"],
      ["12:30", "sky"],
      ["14:00", "violet"],
    ],
  },
  { day: "Ня", date: 11, events: [["12:00", "sage"]] },
];
// W = worked, O = day off, "." = not marked yet.
const attendance = [
  { name: "Ану", days: "WWWWWOWWWWWWOW" },
  { name: "Болор", days: "WWOWWWWOWWWWW." },
  { name: "Сувд", days: "OWWWWWOWWWWOW." },
];
const stock = [
  { name: "Гель лак №12", sku: "ГЛ-012", qty: 24, price: 18_000 },
  { name: "Үсний будаг 6.0", sku: "ҮБ-060", qty: 9, price: 32_000 },
  { name: "Сормуусны цавуу", sku: "СЦ-003", qty: 2, price: 45_000, low: true },
  { name: "Хумсны тос", sku: "ХТ-021", qty: 15, price: 12_000 },
];
const extras = [
  {
    icon: History,
    title: "Үйлчлүүлэгчийн түүх",
    text: "Хэн, хэзээ, ямар үйлчилгээ авсныг нэг товшилтоор.",
  },
  {
    icon: BellRing,
    title: "Мэдэгдэл, сануулга",
    text: "Захиалга бүрд үйлчлүүлэгчид мессеж очно.",
  },
];
// Signed-in visitors skip sign-up: straight to their salon, or to onboarding.
async function startHref() {
  if (!configured) return "/sign-up";
  const user = await identity().catch(() => null);
  if (!user) return "/sign-up";
  const member = await db.salonMember.findFirst({
    where: { userId: user.id, active: true },
    select: { id: true },
  });
  return member ? "/" : "/onboarding";
}
export default async function BusinessPage() {
  const start = await startHref();
  const signedIn = start !== "/sign-up";
  const phone = site.phone && formatSitePhone(site.phone);
  const handle = site.instagram.replace(/^@/, "");
  const cta = "Бизнесээ бүртгүүлэх";
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/business" className="lp-logo" aria-label="Salon77 нүүр">
          <span className="lp-logo-mark">s</span>
          salon77<span className="lp-dot">.</span>
        </Link>
        <nav aria-label="Хуудасны хэсгүүд">
          <a href="#product">Тайлан, календар</a>
          <a href="#features">Боломжууд</a>
          <a href="#how">Хэрхэн ажилладаг</a>
          <a href="#faq">Асуулт</a>
          <a href="#about">Бидний тухай</a>
        </nav>
        <div className="lp-nav-actions">
          {/* Signed-in owners keep a way back to their salon admin. */}
          <Link
            href={signedIn ? start : "/sign-in"}
            className="lp-btn small outline"
          >
            {signedIn ? "Миний салон" : "Нэвтрэх / Бүртгүүлэх"}
          </Link>
        </div>
      </header>
      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <span className="lp-pill">
              <Sparkles size={13} /> Гоо сайхны салонд зориулсан
            </span>
            <h1>
              Захиалгаа цэгцэлж,
              <br />
              салоноо онлайн болгоё<span className="lp-dot">.</span>
            </h1>
            <p>
              Инстаграм мессеж, утас, дэвтэрт тархсан захиалгыг нэг дор.
              Үйлчлүүлэгчид тань 24 цагийн турш онлайнаар цаг авч, та бүх зүйлээ
              утаснаасаа удирдана.
            </p>
            <div className="lp-cta">
              <Link href={start} className="lp-btn">
                {cta} <ArrowRight size={16} />
              </Link>
              <a href="#features" className="lp-link underline">
                Юу багтдаг вэ?
              </a>
            </div>
          </div>
          <div className="lp-mock" aria-hidden="true">
            <div className="lp-window">
              <div className="lp-window-bar">
                <i />
                <i />
                <i />
                <span>Календар · Өнөөдөр</span>
              </div>
              <div className="lp-cal">
                <div className="lp-cal-times">
                  {["10:00", "11:00", "12:00", "13:00", "14:00"].map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                {["Ану", "Болор", "Сувд"].map((staff, col) => (
                  <div className="lp-cal-col" key={staff}>
                    <b>{staff}</b>
                    <div className="lp-cal-track">
                      {calendar
                        .filter((c) => c.col === col)
                        .map((c) => (
                          <div
                            key={c.name}
                            className={`lp-event tone-${c.tone}`}
                            style={{
                              top: `${c.top * 20}%`,
                              height: `calc(${c.h * 20}% - 4px)`,
                            }}
                          >
                            <small>
                              {10 + c.top}:00–{10 + c.top + c.h}:00
                            </small>
                            <strong>
                              <Star
                                size={11}
                                className={c.regular ? "on" : ""}
                              />
                              {c.name}
                            </strong>
                            <span>{c.what}</span>
                            <b>{formatMnt(c.price)}</b>
                            <em className={c.done ? "on" : ""}>
                              {c.done && <Check size={10} strokeWidth={3} />}
                            </em>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-phone">
              <div className="lp-phone-cover" />
              <strong>Таны салон</strong>
              <span>Өөрт тохирох цагаа сонгоорой</span>
              <div className="lp-phone-times">
                {["10:00", "10:30", "11:00", "13:30", "14:00", "15:30"].map(
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
        </section>
        <section className="lp-problem">
          <p>
            Мессежинд хариулж амжихгүй, давхар захиалга, ирээгүй үйлчлүүлэгч,
            дэвтэрт бичсэн хуваарь…
          </p>
          <strong>Salon77 эдгээрийг нэг дор шийднэ.</strong>
        </section>
        <section id="product" className="lp-section">
          <div className="lp-heading">
            <span className="lp-eyebrow">НЭГ ДЭЛГЭЦЭЭС</span>
            <h2>Орлого, захиалга, ажилтнаа тоогоор хараарай</h2>
            <p>
              Тайлан, календар, үйлчилгээ болон ажилтнаар орсон орлого бүгд
              автоматаар бодогдоно. Дэвтэр, тооны машин хэрэггүй.
            </p>
          </div>
          <div className="lp-bento">
            <article className="lp-tile">
              <header>
                <span className="lp-icon">
                  <CalendarDays size={19} />
                </span>
                <div>
                  <h3>Календар</h3>
                  <p>Өдөр, долоо хоногоор. Салбар, ажилтнаар шүүнэ.</p>
                </div>
              </header>
              <div className="lp-week" aria-hidden="true">
                {week.map((d) => (
                  <div key={d.day} className={d.date === 9 ? "today" : ""}>
                    <span>{d.day}</span>
                    <b>{d.date}</b>
                    {d.events.map(([time, tone]) => (
                      <i key={time} className={`tone-${tone}`}>
                        {time}
                      </i>
                    ))}
                  </div>
                ))}
              </div>
            </article>
            <article className="lp-tile">
              <header>
                <span className="lp-icon">
                  <ChartNoAxesCombined size={19} />
                </span>
                <div>
                  <h3>Орлогын тайлан</h3>
                  <p>Өдөр, 7 хоног, сар, салбараар шүүж харна.</p>
                </div>
              </header>
              <div className="lp-report" aria-hidden="true">
                <div className="lp-report-top">
                  <div>
                    <span>Энэ сарын орлого</span>
                    <strong>{formatMnt(showcaseRevenue)}</strong>
                  </div>
                  <em>
                    <TrendingUp size={13} /> +18%
                  </em>
                </div>
                <div className="lp-bars">
                  {revenueBars.map((h, i) => (
                    <i
                      key={i}
                      className={h === 100 ? "peak" : ""}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="lp-report-stats">
                  <div>
                    <span>Дууссан захиалга</span>
                    <b>{showcaseCount}</b>
                  </div>
                  <div>
                    <span>Дундаж дүн</span>
                    <b>
                      {formatMnt(Math.round(showcaseRevenue / showcaseCount))}
                    </b>
                  </div>
                  <div>
                    <span>Ирээгүй</span>
                    <b>6</b>
                  </div>
                </div>
              </div>
            </article>
            <article className="lp-tile">
              <header>
                <span className="lp-icon">
                  <Scissors size={19} />
                </span>
                <div>
                  <h3>Үйлчилгээгээр орсон орлого</h3>
                  <p>Аль үйлчилгээ хамгийн их орлого авчирдгийг харна.</p>
                </div>
              </header>
              <ul className="lp-breakdown" aria-hidden="true">
                {byService.map((s) => (
                  <li key={s.name} className={`tone-${s.tone}`}>
                    <div>
                      <strong>{s.name}</strong>
                      <span>{s.count} удаа</span>
                      <b>{formatMnt(s.revenue)}</b>
                    </div>
                    <span className="lp-breakdown-track">
                      <span
                        style={{
                          width: `${(s.revenue / byService[0].revenue) * 100}%`,
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="lp-tile">
              <header>
                <span className="lp-icon">
                  <UserRound size={19} />
                </span>
                <div>
                  <h3>Ажилтнаар орсон орлого</h3>
                  <p>Хэн хэдэн үйлчилгээ хийж, хэдийг оруулсныг харна.</p>
                </div>
              </header>
              <ul className="lp-staff" aria-hidden="true">
                {byStaff.map((s, i) => (
                  <li key={s.name}>
                    <span className="lp-avatar">{s.name[0]}</span>
                    <div>
                      <strong>{s.name}</strong>
                      <span>{s.count} үйлчилгээ</span>
                    </div>
                    <b>{formatMnt(s.revenue)}</b>
                    {i === 0 && <em>Тэргүүлэгч</em>}
                  </li>
                ))}
              </ul>
            </article>
            <article className="lp-tile">
              <header>
                <span className="lp-icon">
                  <ClipboardCheck size={19} />
                </span>
                <div>
                  <h3>Цагийн бүртгэл</h3>
                  <p>
                    Ажилтны ажилласан өдрийг нэг товшилтоор чагтална. Сарын
                    эцэст нийт өдөр бэлэн.
                  </p>
                </div>
              </header>
              <div className="lp-sheet" aria-hidden="true">
                {attendance.map((a) => (
                  <div key={a.name}>
                    <span className="lp-avatar">{a.name[0]}</span>
                    <strong>{a.name}</strong>
                    <b>{a.days.split("W").length - 1} өдөр</b>
                    <div className="lp-sheet-days">
                      {[...a.days].map((d, i) => (
                        <i
                          key={i}
                          className={
                            d === "W" ? "worked" : d === "O" ? "off" : ""
                          }
                        >
                          {d === "W" ? (
                            <Check size={11} strokeWidth={3} />
                          ) : d === "O" ? (
                            "А"
                          ) : (
                            i + 1
                          )}
                        </i>
                      ))}
                    </div>
                  </div>
                ))}
                <p>
                  <i className="worked">
                    <Check size={10} strokeWidth={3} />
                  </i>
                  Ажилласан
                  <i className="off">А</i>
                  Амарсан
                </p>
              </div>
            </article>
            <article className="lp-tile">
              <header>
                <span className="lp-icon">
                  <Boxes size={19} />
                </span>
                <div>
                  <h3>Бараа бүртгэл</h3>
                  <p>Салбар бүрийн үлдэгдэл, дуусах дөхсөн барааг харна.</p>
                </div>
              </header>
              <ul className="lp-stock" aria-hidden="true">
                {stock.map((p) => (
                  <li key={p.sku}>
                    <div>
                      <strong>{p.name}</strong>
                      <span>
                        {p.sku} · {formatMnt(p.price)}
                      </span>
                      {p.low && <em>Дуусах дөхсөн</em>}
                    </div>
                    <span className="lp-stepper">
                      <i>−</i>
                      <b className={p.low ? "low" : ""}>{p.qty} ш</b>
                      <i>+</i>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <div className="lp-extras">
            {extras.map((e) => (
              <article key={e.title}>
                <e.icon size={18} />
                <div>
                  <h3>{e.title}</h3>
                  <p>{e.text}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="lp-sample-note">
            Дээрх тоонууд нь жишээ. Бүртгүүлсний дараа таны салоны бодит өгөгдөл
            харагдана.
          </p>
        </section>
        <section id="features" className="lp-section">
          <div className="lp-heading">
            <span className="lp-eyebrow">ЮУ БАГТДАГ ВЭ</span>
            <h2>Салонд хэрэгтэй бүх зүйл нэг дор</h2>
            <p>
              Бүртгүүлмэгц бүх боломж нээгдэнэ. Нэмэлт програм, тохиргоо
              шаардлагагүй.
            </p>
          </div>
          <div className="lp-groups">
            {groups.map((g) => (
              <article key={g.title}>
                <span className="lp-icon">
                  <g.icon size={19} />
                </span>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
                <ul>
                  {g.items.map((item) => (
                    <li key={item}>
                      <Check size={14} /> {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
        <section className="lp-section">
          <div className="lp-linkband">
            <div>
              <span className="lp-eyebrow">САЛОН БҮРД ӨӨРИЙН ЛИНК</span>
              <h2>Нэг линкээр захиалга авна</h2>
              <p>
                Салон тань баталгаажмагц бүртгүүлэхдээ сонгосон хаягаар
                захиалгын хуудас тань нээгдэнэ. Түүнийг Инстаграм хуудас,
                мессеж, нэрийн хуудсандаа тавиад л болно.
              </p>
            </div>
            <div className="lp-url">
              <span className="lp-url-bar">salon77.mn/таны-салон/book</span>
              <ul>
                <li>
                  <MessageSquare size={15} /> Захиалга бүрд үйлчлүүлэгчид мессеж
                  мэдэгдэл
                </li>
                <li>
                  <CalendarCheck size={15} /> Захиалга шууд таны календарьт орно
                </li>
              </ul>
            </div>
          </div>
        </section>
        <section id="how" className="lp-section">
          <div className="lp-heading">
            <span className="lp-eyebrow">ХЭРХЭН АЖИЛЛАДАГ ВЭ</span>
            <h2>Гуравхан алхмаар эхэлнэ</h2>
          </div>
          <ol className="lp-steps">
            {steps.map(([title, text], i) => (
              <li key={title}>
                <span>{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section id="faq" className="lp-section lp-faq">
          <div className="lp-heading">
            <span className="lp-eyebrow">ТҮГЭЭМЭЛ АСУУЛТ</span>
            <h2>Асуух зүйл байна уу?</h2>
          </div>
          <div>
            {faq.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section id="about" className="lp-section lp-about">
          <div>
            <span className="lp-eyebrow">БИДНИЙ ТУХАЙ</span>
            <h2>Монгол салонуудад зориулсан систем</h2>
            <p>{site.about}</p>
          </div>
          {(phone || handle) && (
            <div className="lp-contact">
              <h3>Холбоо барих</h3>
              {phone && (
                <a href={`tel:${site.phone.replace(/\s/g, "")}`}>
                  <Phone size={17} /> {phone}
                </a>
              )}
              {handle && (
                <a
                  href={`https://instagram.com/${handle}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <AtSign size={17} /> {handle}
                </a>
              )}
            </div>
          )}
        </section>
        <section className="lp-final">
          <h2>Салоноо өнөөдрөөс онлайн болгоорой</h2>
          <p>Бүртгүүлэх үнэгүй, хэдхэн минутад тохируулна.</p>
          <Link href={start} className="lp-btn light">
            {cta} <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} Salon77</span>
        <span>Таны салоны өсөлтөд зориулав.</span>
      </footer>
    </div>
  );
}
