import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BellRing,
  Boxes,
  Calculator,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ClipboardCheck,
  History,
  Landmark,
  Link2,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  Receipt,
  ShieldCheck,
  Scissors,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  UserRound,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { sessionUser } from "@/lib/auth";
import { site } from "@/lib/site";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { formatMnt } from "@/lib/ui-language";
import { smsDelivers } from "@/lib/notifications/provider";
import { PERIOD_DAYS, TRIAL_DAYS, monthlyAmount } from "@/lib/billing";
import { pricePerBranch } from "@/lib/services/billing";
import { SignupPrep } from "@/components/signup-prep";
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
    `Имэйлээрээ бүртгүүлээд салоныхоо мэдээллийг илгээнэ. Бид ${site.reviewTime} шалгаад баталгаажуулна.`,
  ],
  ["Тохируулах", "Үйлчилгээ, үнэ, ажилтан, ажлын цагаа нэмнэ. Хэдхэн минут."],
  [
    "Линкээ хуваалцах",
    "Захиалгын линкээ Инстаграм, Фэйсбүүк хуудсандаа тавиад захиалга аваад эхэлнэ.",
  ],
];
// Mirrors lib/billing.ts: a free trial from approval, then a monthly fee per
// active branch unless the operator agreed a salon's own price.
const pricing = (pricePerBranch: number | null) => [
  [
    "Төлбөр хэд вэ?",
    `Салоноо баталгаажуулсан өдрөөс ${TRIAL_DAYS} хоног бүх боломж бүрэн үнэгүй. Дараа нь идэвхтэй салбарын тоогоор сар бүр төлнө${
      pricePerBranch
        ? `: нэг салбар ${PERIOD_DAYS} хоногт ${formatMnt(pricePerBranch)}.`
        : ". Үнийг үнэгүй хугацаа дуусахаас өмнө танд мэдэгдэнэ."
    } Олон салбартай эсвэл онцгой нөхцөлтэй салонтой үнийг тусад нь тохирно.`,
  ],
  [
    "Үнэгүй хугацаа дуусахад яах вэ?",
    "Үргэлжлүүлэх эсвэл зогсоохоо өөрөө сонгоно. Төлбөр хийгээгүй бол захиалгын хуудас түр хаагдах боловч мэдээлэл тань устахгүй, төлбөр орсны дараа бүгд дахин нээгдэнэ.",
  ],
];
const faq = [
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
// "Sound familiar?" cards: a common pain, then how the product handles it.
const pains = [
  {
    id: "messages",
    icon: MessageCircle,
    title: "Инстаграм, утасны мессежинд хариулж амжихгүй",
    text: "Үйлчилгээ хийж байхад утас дуугарч, оройн мессеж хариугүй үлдэж, үйлчлүүлэгч өөр салон руу явчихдаг.",
    fix: "Захиалгын линкээ хуваалцахад үйлчлүүлэгч сул цагаа өөрөө харж, 24 цагийн турш цаг авна.",
  },
  {
    id: "double",
    icon: NotebookPen,
    title: "Давхар захиалга, дэвтэрт бичсэн хуваарь",
    text: "Нэг цагт хоёр хүн бичигдэж, дэвтэр салон дээр үлдэж, хэн хэзээ ирэхийг ажилтан бүр мэддэггүй.",
    fix: "Захиалагдсан цаг автоматаар хаагдаж, бүх захиалга нэг календарьт ажилтан бүрээр харагдана.",
  },
  {
    id: "noshow",
    icon: UserX,
    title: "Ирээгүй үйлчлүүлэгч",
    text: "Цаг авчихаад ирэхгүй, урьдчилж хэлэхгүй. Тэр цаг хоосон өнгөрч, орлого алдагдана.",
    fix: "Урьдчилгаа авч цагаа баталгаажуулаад, ирээгүй үйлчлүүлэгчийг түүхэнд нь тэмдэглэнэ.",
  },
  {
    id: "revenue",
    icon: Calculator,
    title: "Сарын орлогоо мэдэхгүй",
    text: "Орлого дэвтэр, банкны хуулга, бэлэн мөнгөнд тарж, аль үйлчилгээ, аль ажилтан их орлого оруулдгийг мэдэхгүй.",
    fix: "Дууссан захиалга бүрээс орлого автоматаар бодогдож, өдөр, сар, үйлчилгээ, ажилтнаар харагдана.",
  },
] as const;
type PainId = (typeof pains)[number]["id"];
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
// Week view events: hours after 09:00, length in hours, tone, customer.
const week: {
  day: string;
  date: number;
  events: [number, number, string, string][];
}[] = [
  {
    day: "Да",
    date: 5,
    events: [
      [1, 1.5, "violet", "Сараа"],
      [4.5, 1.5, "sky", "Оюун"],
    ],
  },
  { day: "Мя", date: 6, events: [[2, 2, "rose", "Номин"]] },
  {
    day: "Лх",
    date: 7,
    events: [
      [0.5, 1.5, "sage", "Ану"],
      [3, 1.5, "violet", "Болор"],
      [6, 1.5, "sand", "Сувд"],
    ],
  },
  {
    day: "Пү",
    date: 8,
    events: [
      [1.5, 1.5, "sky", "Заяа"],
      [5, 2, "rose", "Номин"],
    ],
  },
  {
    day: "Ба",
    date: 9,
    events: [
      [1, 1.5, "violet", "Сараа"],
      [2.5, 1.5, "sage", "Ану"],
      [6, 1.5, "rose", "Туяа"],
    ],
  },
  {
    day: "Бя",
    date: 10,
    events: [
      [1, 1.5, "sand", "Болор"],
      [3.5, 1.5, "sky", "Оюун"],
      [5, 1.5, "violet", "Заяа"],
    ],
  },
  { day: "Ня", date: 11, events: [[3, 1.5, "sage", "Ану"]] },
];
const WEEK_HOURS = 8;
function weekTime(offset: number) {
  const minutes = 9 * 60 + offset * 60;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
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
    sms: true,
  },
];
// Signed-in visitors skip sign-up: straight to their salon, or to onboarding.
async function startHref() {
  if (!configured) return "/sign-up";
  const user = await sessionUser().catch(() => null);
  if (!user) return "/sign-up";
  const member = await db.salonMember.findFirst({
    where: { userId: user.id, active: true },
    select: { id: true },
  });
  return member ? "/" : "/onboarding";
}
async function branchPrice() {
  if (!configured) return null;
  return pricePerBranch(db).catch(() => null);
}
export default async function BusinessPage() {
  // Messages are promised only once a real SMS gateway delivers them.
  const sms = smsDelivers();
  const [start, price] = await Promise.all([startHref(), branchPrice()]);
  const signedIn = start !== "/sign-up";
  const cta = "Бизнесээ бүртгүүлэх";
  return (
    <div className="lp">
      <header className="lp-nav">
        <Logo href="/business" />
        <nav aria-label="Хуудасны хэсгүүд">
          <a href="#problems">Шийдэл</a>
          <a href="#features">Боломжууд</a>
          <a href="#pricing">Үнэ</a>
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
              <a href="#problems" className="lp-link underline">
                Ямар асуудлыг шийддэг вэ?
              </a>
            </div>
          </div>
          <div className="lp-mock" aria-hidden="true">
            <div className="lp-window">
              <div className="lp-window-bar">
                <i />
                <i />
                <i />
                <span>Календарь · Өнөөдөр</span>
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
        <section id="problems" className="lp-section">
          <div className="lp-heading">
            <span className="lp-eyebrow">ТАНД ТАНИЛ УУ?</span>
            <h2>Салон бүрт тулгардаг дөрвөн бэрхшээл</h2>
            <p>Salon77 эдгээрийг нэг дор шийднэ.</p>
          </div>
          <div className="lp-pains">
            {pains.map((p) => (
              <article key={p.id} className="lp-pain">
                <div className="lp-pain-art" aria-hidden="true">
                  <PainArt id={p.id} />
                </div>
                <div className="lp-pain-copy">
                  <h3>
                    <p.icon size={17} />
                    {p.title}
                  </h3>
                  <p>{p.text}</p>
                </div>
                <div className="lp-fix">
                  <span className="lp-fix-label">
                    <Check size={13} strokeWidth={3} /> Salon77-д
                  </span>
                  <p>{p.fix}</p>
                  <div className="lp-shot" aria-hidden="true">
                    <FixShot id={p.id} sms={sms} />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="lp-sample-note">
            Зураг дээрх нэр, тоо нь жишээ.
            {!sms && " Мессеж сануулга удахгүй нэмэгдэнэ."}
          </p>
        </section>
        <section id="product" className="lp-section">
          <div className="lp-heading">
            <span className="lp-eyebrow">НЭГ ДЭЛГЭЦЭЭС</span>
            <h2>Орлого, захиалга, ажилтнаа тоогоор хараарай</h2>
            <p>
              Тайлан, календарь, үйлчилгээ болон ажилтнаар орсон орлого бүгд
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
                  <h3>Календарь</h3>
                  <p>Өдөр, долоо хоногоор харна.</p>
                </div>
              </header>
              <div className="lp-laptop" aria-hidden="true">
                <div className="lp-laptop-screen">
                  <div className="lp-window-bar">
                    <i />
                    <i />
                    <i />
                    <span>Календарь · 7 хоног</span>
                  </div>
                  <div className="lp-wk">
                    <div className="lp-wk-times">
                      {[0, 2, 4, 6, 8].map((h) => (
                        <span key={h}>{weekTime(h)}</span>
                      ))}
                    </div>
                    {week.map((d) => (
                      <div key={d.day} className={d.date === 9 ? "today" : ""}>
                        <span>{d.day}</span>
                        <b>{d.date}</b>
                        <div className="lp-wk-track">
                          {d.events.map(([start, length, tone, name]) => (
                            <i
                              key={start}
                              className={`tone-${tone}`}
                              style={{
                                top: `${(start / WEEK_HOURS) * 100}%`,
                                height: `calc(${(length / WEEK_HOURS) * 100}% - 2px)`,
                              }}
                            >
                              <small>{weekTime(start)}</small>
                              <em>{name}</em>
                            </i>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lp-laptop-base" />
              </div>
            </article>
            <article className="lp-tile">
              <header>
                <span className="lp-icon">
                  <ChartNoAxesCombined size={19} />
                </span>
                <div>
                  <h3>Орлогын тайлан</h3>
                  <p>Өдөр, сар, салбараар шүүнэ.</p>
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
                  <p>Аль үйлчилгээ их орлоготойг харна.</p>
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
                  <p>Хэн хэдийг оруулсныг харна.</p>
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
                  <p>Ажилласан өдрийг чагтална.</p>
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
                  <p>Үлдэгдэл, дуусах дөхсөн бараа.</p>
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
                  <h3>
                    {e.title}
                    {"sms" in e && !sms && (
                      <span className="lp-soon">Удахгүй</span>
                    )}
                  </h3>
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
              <span className="lp-url-bar">{site.domain}/tanii-salon/book</span>
              <ul>
                <li>
                  <MessageSquare size={15} /> Захиалга бүрд үйлчлүүлэгчид мессеж
                  мэдэгдэл
                  {!sms && <span className="lp-soon">Удахгүй</span>}
                </li>
                <li>
                  <CalendarCheck size={15} /> Захиалга шууд таны календарьт орно
                </li>
              </ul>
            </div>
          </div>
        </section>
        <section id="pricing" className="lp-section">
          <div className="lp-heading">
            <span className="lp-eyebrow">ҮНЭ</span>
            <h2>Эхлээд үнэгүй туршаад үзээрэй</h2>
            <p>Нуугдмал төлбөр, урт хугацааны гэрээ байхгүй.</p>
          </div>
          <div className="lp-pricing">
            <div className="lp-price-trial">
              <span className="lp-pill">
                <Sparkles size={13} /> Эхлэх
              </span>
              <strong>{TRIAL_DAYS} хоног үнэгүй</strong>
              <p>
                Салон тань баталгаажсан өдрөөс эхлэн бүх боломжийг үнэгүй
                ашиглана. Карт холбох шаардлагагүй.
              </p>
              <Link href={start} className="lp-btn light">
                {cta} <ArrowRight size={16} />
              </Link>
            </div>
            <div className="lp-price-after">
              <h3>Дараа нь юунаас хамаарч бодогдох вэ?</h3>
              <ul>
                <li>
                  <Store size={18} />
                  <div>
                    <strong>Идэвхтэй салбарын тоо</strong>
                    <span>
                      {price
                        ? `Салбар бүрд ${PERIOD_DAYS} хоног тутам ${formatMnt(price)}. Жишээ нь 2 салбартай бол ${formatMnt(monthlyAmount(price, 2))}.`
                        : `Төлбөр салбар бүрээр ${PERIOD_DAYS} хоног тутам бодогдоно. Үнийг үнэгүй хугацаа дуусахаас өмнө мэдэгдэнэ.`}
                    </span>
                  </div>
                </li>
                <li>
                  <Users size={18} />
                  <div>
                    <strong>Ажилтан, захиалгын тоо хамаарахгүй</strong>
                    <span>
                      Ажилтан нэмэх, олон захиалга авахад төлбөр өсөхгүй.
                    </span>
                  </div>
                </li>
                <li>
                  <Wallet size={18} />
                  <div>
                    <strong>Үргэлжлүүлэх эсэхээ өөрөө шийднэ</strong>
                    <span>
                      Үнэгүй хугацаа дуусахаас өмнө сануулна. Автоматаар мөнгө
                      татахгүй, төлөөгүй ч мэдээлэл тань устахгүй.
                    </span>
                  </div>
                </li>
                <li>
                  <Landmark size={18} />
                  <div>
                    <strong>Банкны шилжүүлгээр төлнө</strong>
                    <span>Дансны мэдээлэл удирдлагын хэсэгт харагдана.</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>
        <section id="prepare" className="lp-section">
          <div className="lp-heading">
            <span className="lp-eyebrow">БҮРТГҮҮЛЭХЭЭС ӨМНӨ</span>
            <h2>Юу бэлдэх вэ?</h2>
            <p>
              Эдгээрийг урьдчилан бэлдвэл бүртгэл хурдан, баталгаажуулалт
              саадгүй болно.
            </p>
          </div>
          <SignupPrep heading="h3" />
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
            {[...pricing(price), ...faq].map(([q, a]) => (
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
        </section>
        <section className="lp-final">
          <h2>Салоноо өнөөдрөөс онлайн болгоорой</h2>
          <p>{TRIAL_DAYS} хоног бүрэн үнэгүй, хэдхэн минутад тохируулна.</p>
          <Link href={start} className="lp-btn light">
            {cta} <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
// Small drawings of each pain; decorative, the card text carries the meaning.
function PainArt({ id }: { id: PainId }) {
  if (id === "messages")
    return (
      <div className="lp-art-chat">
        <i>Сайн байна уу, маргааш 3 цагт сул уу?</i>
        <i>Үнэ нь хэд вэ?</i>
        <i>Хариу өгөөч…</i>
        <b>+12</b>
      </div>
    );
  if (id === "double")
    return (
      <div className="lp-art-book">
        <i>
          <span>13:00</span> Оюун · үс засалт
        </i>
        <i className="clash">
          <span>14:00</span> Сараа · гел
        </i>
        <i className="clash">
          <span>14:00</span> Номин · маникюр
        </i>
        <i>
          <span>15:30</span> ???
        </i>
      </div>
    );
  if (id === "noshow")
    return (
      <div className="lp-art-empty">
        <UserX size={26} />
        <div>
          <span>15:00 · Сормуус</span>
          <strong>Хүлээсээр…</strong>
        </div>
      </div>
    );
  return (
    <div className="lp-art-cash">
      <Receipt size={22} />
      <NotebookPen size={22} />
      <div>
        <span>Энэ сарын орлого</span>
        <strong>? ₮</strong>
      </div>
    </div>
  );
}
// Miniature views of the real screens that solve each pain.
function FixShot({ id, sms }: { id: PainId; sms: boolean }) {
  if (id === "messages")
    return (
      <div className="lp-shot-book">
        <strong>Цаг сонгох</strong>
        <div>
          {["10:00", "11:30", "14:00", "16:30"].map((t, i) => (
            <i key={t} className={i === 1 ? "on" : ""}>
              {t}
            </i>
          ))}
        </div>
        <em>
          <CalendarCheck size={12} /> Шинэ захиалга · 23:40 · Номин Д.
        </em>
      </div>
    );
  if (id === "double")
    return (
      <div className="lp-shot-slots">
        <span>Ану · Баасан</span>
        <div>
          <i>13:00</i>
          <i className="taken">14:00</i>
          <i>15:00</i>
          <i>16:00</i>
        </div>
        <small>14:00 захиалагдсан тул сонгох боломжгүй</small>
      </div>
    );
  if (id === "noshow")
    return (
      <div className="lp-shot-deposit">
        <div>
          <span>Урьдчилгаа 30%</span>
          <b>{formatMnt(24_000)}</b>
          <em className="ok">Төлсөн</em>
        </div>
        <div>
          <span>Мессеж сануулга</span>
          <em className={sms ? "ok" : "soon"}>
            {sms ? "Илгээсэн" : "Удахгүй"}
          </em>
        </div>
        <div>
          <span>Өмнөх захиалга</span>
          <em className="miss">Ирээгүй · 1</em>
        </div>
      </div>
    );
  return (
    <div className="lp-shot-report">
      <div>
        <span>Энэ сарын орлого</span>
        <strong>{formatMnt(showcaseRevenue)}</strong>
      </div>
      <div className="lp-shot-bars">
        {revenueBars.slice(-8).map((h, i) => (
          <i key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
