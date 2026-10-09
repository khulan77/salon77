import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  AtSign,
  CalendarCheck,
  Check,
  Link2,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { identity } from "@/lib/auth";
import { site, formatSitePhone } from "@/lib/site";
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
    "Имэйлээрээ бүртгүүлээд салоныхоо нэр, хаяг, эхний салбараа оруулна.",
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
    tone: "violet",
  },
  {
    col: 1,
    top: 1,
    h: 3,
    name: "Номин Д.",
    what: "Маникюр, педикюр",
    tone: "rose",
  },
  { col: 2, top: 0, h: 1, name: "Ану Т.", what: "Сормуус", tone: "sage" },
  { col: 0, top: 3, h: 2, name: "Оюун Г.", what: "Үс засалт", tone: "sky" },
  {
    col: 2,
    top: 2,
    h: 2,
    name: "Болор Э.",
    what: "Нүүр арчилгаа",
    tone: "sand",
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
                            <strong>{c.name}</strong>
                            <span>{c.what}</span>
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
                Бүртгүүлэхдээ сонгосон хаягаар таны захиалгын хуудас шууд
                нээгдэнэ. Түүнийг Инстаграм хуудас, мессеж, нэрийн хуудсандаа
                тавиад л болно.
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
