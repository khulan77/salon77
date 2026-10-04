"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Users,
  Wallet,
  UserRoundCheck,
  Clock3,
  MapPin,
  Check,
  Sparkles,
  CircleHelp,
  Sprout,
  ChartNoAxesCombined,
  CheckCheck,
  X,
  Store,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";
import { formatMongolianDate } from "@/lib/ui-language";
import type { AdminData } from "@/lib/admin-data";
export function Dashboard({ data }: { data: AdminData }) {
  const [branch, setBranch] = useState("all");
  const [period, setPeriod] = useState("Энэ сар");
  const [welcome, setWelcome] = useState(true);
  const complete = [
    !data.preview,
    data.branches.length > 0,
    data.members.length > 1,
  ];
  const done = complete.filter(Boolean).length;
  const date = formatMongolianDate(new Date());
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> САЛОНЫ ҮЙЛ АЖИЛЛАГААНЫ ТОЙМ
          </div>
          <h1>
            Өнөөдрийг бүтээлчээр эхэлье<span className="heading-dot">.</span>{" "}
            <span className="greeting-spark">✳</span>
          </h1>
          <p>Тавтай морил. Өнөөдрийн ажлаа эндээс хянаарай.</p>
        </div>
        <div className="heading-controls">
          <div className="select-wrap">
            <MapPin size={15} />
            <select
              aria-label="Салбараар шүүх"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="all">Бүх салбар</option>
              {data.branches
                .filter((b) => b.active)
                .map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <ChevronDown size={13} />
          </div>
          <Button variant="outline" asChild>
            <Link href="/salon-page">
              Салоны хуудас <ArrowUpRight size={15} />
            </Link>
          </Button>
        </div>
      </div>
      {welcome && (
        <section className="welcome-banner">
          <div className="welcome-copy">
            <span className="pill">
              <span /> ШИНЭ ЭХЛЭЛ
            </span>
            <h2>Салоныхоо шинэ эхлэлийг тавья.</h2>
            <p>
              Хэдхэн тохиргоо хийгээд ажлаа хялбарчлаарай.
              <br />
              Салоныхоо мэдээллийг нэмээд эхэлье.
            </p>
            <Button asChild>
              <Link href={data.preview ? "/onboarding" : "/branches"}>
                Салоноо тохируулах <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <span className="art-star star-one">✦</span>
            <span className="art-star star-two">✧</span>
            <div className="art-small-card">
              <span className="art-small-icon">
                <CheckCheck size={19} />
              </span>
              <div>
                <strong>Ажил цэгцтэй.</strong>
                <span>Танд илүү цаг.</span>
              </div>
            </div>
            <div className="art-main-card">
              <div className="art-card-top">
                <span className="art-logo">s.</span>
                <span>ТАНЫ САЛОН НЭГ ДОР</span>
                <span>↗</span>
              </div>
              <div className="art-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="art-card-bottom">
                <span>Өсөх боломж</span>
                <span>✦</span>
              </div>
            </div>
            <div className="art-floating">
              <Sprout size={25} strokeWidth={1.5} />
            </div>
          </div>
          <button
            className="dismiss-banner"
            aria-label="Танилцуулга хаах"
            onClick={() => setWelcome(false)}
          >
            <X size={16} />
          </button>
        </section>
      )}
      <div className="section-title">
        <h2>
          Өнөөдрийн тойм <span className="live-dot" />
        </h2>
        <span className="date-label">{date}</span>
      </div>
      <section className="stats-grid" aria-label="Өнөөдрийн үзүүлэлтүүд">
        {[
          {
            title: "Өнөөдрийн захиалгууд",
            icon: CalendarDays,
            value: "0",
            text: "Одоогоор захиалга алга.",
            color: "purple",
          },
          {
            title: "Өнөөдрийн үйлчлүүлэгчид",
            icon: Users,
            value: "0",
            text: "Шинэ үйлчлүүлэгчээ угтаарай",
            color: "blue",
          },
          {
            title: "Өнөөдрийн орлого",
            icon: Wallet,
            value: "0",
            text: "Орлогын мэдээлэл энд харагдана",
            color: "green",
            suffix: "₮",
          },
          {
            title: "Өнөөдөр ажиллах хүн",
            icon: UserRoundCheck,
            value: "0",
            text: "Багийн хуваарь нэг дор",
            color: "orange",
          },
        ].map((stat) => (
          <article className="stat-card" key={stat.title}>
            <div className="stat-top">
              <span>{stat.title}</span>
              <span className={`stat-icon ${stat.color}`}>
                <stat.icon size={18} strokeWidth={1.6} />
              </span>
            </div>
            <div className="stat-number">
              {stat.value}
              <span>{stat.suffix}</span>
            </div>
            <p>
              <span className="stat-dash">—</span>
              {stat.text}
            </p>
          </article>
        ))}
      </section>
      <div className="dashboard-middle">
        <section className="panel appointments-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Өнөөдрийн захиалгууд <span className="count-badge">0</span>
              </h2>
              <p>Өнөөдрийн ажлаа төлөвлөөрэй.</p>
            </div>
            <Link href="/calendar" className="text-link">
              Календар харах <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="appointment-empty">
            <div className="calendar-illustration">
              <div className="calendar-tabs">
                <i />
                <i />
              </div>
              <div className="calendar-grid">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className={i === 4 ? "selected" : ""}>
                    {i === 4 ? <Check size={13} /> : ""}
                  </span>
                ))}
              </div>
              <span className="calendar-spark">✦</span>
            </div>
            <h3>Өнөөдөр товлосон захиалга алга</h3>
            <p>Өнөөдрийн захиалга алга.</p>
            <span className="empty-detail">
              Захиалгын боломж нээгдэхэд энд харагдана.
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/calendar">
                <CalendarDays size={14} /> Календар нээх{" "}
                <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
          <div className="panel-bottom">
            <span>
              <Clock3 size={13} /> Улаанбаатарын цагаар (UTC+8)
            </span>
            <span className="quiet-badge">Захиалга · Удахгүй</span>
          </div>
        </section>
        <section className="panel setup-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow purple-text">ЭХЛЭХ АЛХМУУД</span>
              <h2>Салоноо ажилд бэлдэе</h2>
            </div>
            <span className="setup-spark">✧</span>
          </div>
          <div className="setup-progress">
            <div>
              <span>Эхний тохиргоонууд</span>
              <strong>3 алхмаас {done} нь бэлэн</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${(done / 3) * 100}%` }} />
            </div>
          </div>
          <div className="checklist">
            {[
              {
                title: "Салон үүсгэх",
                text: "Салоныхоо мэдээллийг бүртгэх",
                href: "/onboarding",
                icon: Store,
              },
              {
                title: "Эхний салбараа нэмэх",
                text: "Салбарынхаа байршлыг оруулах",
                href: "/branches",
                icon: MapPin,
              },
              {
                title: "Багаа бүрдүүлэх",
                text: "Хамт олноо нэгтгээрэй",
                href: "/team",
                icon: Users,
              },
            ].map((item, i) => (
              <Link
                href={item.href}
                className={`checklist-item ${complete[i] ? "complete" : ""}`}
                key={item.title}
              >
                <span className="check-circle">
                  {complete[i] ? <Check size={12} /> : <item.icon size={15} />}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
          <div className="setup-note">
            <ShieldCheck size={15} />
            <span>Өөрт тохирсон хурдаар эхлээрэй.</span>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel insights-panel">
          <div className="panel-heading">
            <div>
              <h2>
                Бизнесийн тойм удахгүй{" "}
                <span className="subtle-pill">ДҮН ШИНЖИЛГЭЭ</span>
              </h2>
              <p>Өдөр тутмын үр дүнгээ хянаж, өсөлтөө төлөвлөөрэй.</p>
            </div>
            <div className="select-wrap compact">
              <select
                aria-label="Тайлангийн хугацаа"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option>Энэ сар</option>
                <option>Өмнөх сар</option>
                <option>Энэ жил</option>
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          <div className="insight-content">
            <div className="insight-icon">
              <ChartNoAxesCombined size={24} strokeWidth={1.3} />
            </div>
            <div>
              <h3>Таны өсөлт эндээс эхэлнэ</h3>
              <p>
                Орлого, захиалга, үйлчлүүлэгчдийн өөрчлөлт энд харагдана.
                <br />
                Бодит мэдээлэлд тулгуурлан шийдвэр гаргаарай.
              </p>
            </div>
            <div className="empty-chart" aria-hidden="true">
              {[26, 44, 35, 57, 47, 70, 61, 82, 72, 96, 87, 112].map(
                (height, i) => (
                  <i key={i} style={{ height }} />
                ),
              )}
            </div>
          </div>
          <div className="insight-tags">
            <span>
              <i className="purple-dot" /> Сарын орлого
            </span>
            <span>
              <i className="blue-dot" /> Захиалгын өөрчлөлт
            </span>
            <span>
              <i className="green-dot" /> Үйлчлүүлэгчдийн өсөлт
            </span>
          </div>
        </section>
        <section className="help-card">
          <div className="help-icon">
            <Sparkles size={20} strokeWidth={1.5} />
          </div>
          <h2>
            Та үйлчлүүлэгчдээ халамжил.
            <br />
            Бид ажлыг тань хөнгөвчилье.
          </h2>
          <p>
            Салоноо удирдах ажлыг
            <br />
            алхам бүрд хялбарчилна.
          </p>
          <Link href="/support">
            Эхлэхэд тусалъя <ArrowUpRight size={16} />
          </Link>
          <CircleHelp
            className="help-decoration"
            size={110}
            strokeWidth={0.6}
          />
        </section>
      </div>
      {data.preview && (
        <div className="preview-note">
          <span className="preview-indicator" /> Та танилцах горимд байна.{" "}
          <Link href="/sign-up">
            Бүртгүүлэх <ArrowRight size={12} />
          </Link>
          <span>Энд жишээ орлого, захиалга оруулаагүй.</span>
        </div>
      )}
    </>
  );
}
