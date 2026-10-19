"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Globe,
  ShieldCheck,
} from "lucide-react";
import "@/app/business-showcase.css";

const labels = [
  "Онлайн захиалга",
  "Календарь",
  "Баталгаажуулалт",
  "Орлогын тайлан",
];
const icons = [Globe, CalendarDays, ShieldCheck, Wallet];

type ShowcaseItem = {
  id: string;
  title: string;
  problem: string;
  solution: string;
  preview: ReactNode;
};

export function BusinessShowcase({ items }: { items: ShowcaseItem[] }) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  function select(index: number) {
    const next = (index + items.length) % items.length;
    if (next === active) return;
    setDirection(next > active ? 1 : -1);
    setActive(next);
  }
  const item = items[active];
  return (
    <div className="bs-showcase" id="product">
      <div className="bs-selector" role="group" aria-label="Боломж сонгох">
        {items.map((entry, index) => {
          const Icon = icons[index];
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active === index}
              aria-controls="bs-panel"
              onPointerEnter={(event) => {
                if (
                  event.pointerType === "mouse" &&
                  !event.currentTarget.parentElement?.contains(
                    document.activeElement,
                  )
                )
                  select(index);
              }}
              onClick={() => select(index)}
              onFocus={() => select(index)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{labels[index]}</span>
              <span className="bs-tab-number">0{index + 1}</span>
            </button>
          );
        })}
      </div>
      <div id="bs-panel" className="bs-stage">
        <div className="bs-slide">
          <div className="bs-story">
            <span className="bs-kicker">
              Өдөр тутмын ажлыг хялбарчилна · 0{active + 1}
            </span>
            <h3>{item.title}</h3>
            <p className="bs-problem">{item.problem}</p>
            <div className="bs-answer">
              <span>
                <Check size={15} aria-hidden="true" /> Salon77-ийн шийдэл
              </span>
              <p>{item.solution}</p>
            </div>
            <div className="bs-navigation">
              <button
                type="button"
                onClick={() => select(active - 1)}
                aria-label="Өмнөх боломж"
              >
                <ArrowLeft size={18} />
              </button>
              <span role="status" aria-live="polite">
                {active + 1} / {items.length} · {labels[active]}
              </span>
              <button
                type="button"
                onClick={() => select(active + 1)}
                aria-label="Дараагийн боломж"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
          <div
            key={item.id}
            className={`bs-dashboard bs-animated ${direction < 0 ? "bs-back" : ""}`}
          >
            <header className="bs-dashboard-bar">
              <span className="bs-app-icon">
                <LayoutDashboard size={18} />
              </span>
              <strong>
                Salon77 <span>/ {labels[active]}</span>
              </strong>
              <span className="bs-demo">Жишээ самбар</span>
            </header>
            <div className="bs-dashboard-body">
              <div className="bs-screen-heading">
                <div>
                  <span>Таны салон</span>
                  <h4>{labels[active]}</h4>
                </div>
                <span className="bs-screen-badge">
                  <span /> Нэг дороос
                </span>
              </div>
              <div
                className={`bs-screen bs-screen-${item.id}`}
                tabIndex={item.id === "revenue" ? 0 : undefined}
                role={item.id === "revenue" ? "region" : undefined}
                aria-label={
                  item.id === "revenue"
                    ? "Орлогын дэлгэрэнгүй задаргаа"
                    : undefined
                }
              >
                {item.preview}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bs-progress" aria-hidden="true">
        {items.map((entry, i) => (
          <span key={entry.id} className={i === active ? "active" : ""} />
        ))}
      </div>
    </div>
  );
}
