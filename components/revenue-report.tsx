"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import { RevenueChart, averageLabel } from "./revenue-chart";
import { addDays, localStamp } from "@/lib/business-time";
import { formatDayLabel, formatMnt } from "@/lib/ui-language";
import type { RevenueReport as Report } from "@/lib/services/reports";
import type { BranchView } from "@/lib/admin-data";
function presets() {
  const today = localStamp(new Date()).slice(0, 10),
    month = `${today.slice(0, 8)}01`,
    previous = addDays(month, -1);
  return [
    { label: "Өнөөдөр", from: today, to: today },
    { label: "7 хоног", from: addDays(today, -6), to: today },
    { label: "Энэ сар", from: month, to: today },
    {
      label: "Өнгөрсөн сар",
      from: `${previous.slice(0, 8)}01`,
      to: previous,
    },
  ];
}
export function RevenueReport({
  report,
  branches,
  preview,
}: {
  report: Report;
  branches: BranchView[];
  preview: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<"service" | "staff">("service");
  const go = (next: { from?: string; to?: string; branchId?: string }) => {
    const value = { from: report.from, to: report.to, ...next };
    if (value.from > value.to) value.to = value.from;
    const query = new URLSearchParams({ from: value.from, to: value.to });
    const branch = "branchId" in next ? next.branchId : report.branchId;
    if (branch) query.set("branchId", branch);
    start(() => router.push(`/reports?${query}`));
  };
  const branchName =
    branches.find((b) => b.id === report.branchId)?.name ?? "Бүх салбар";
  const range =
    report.from === report.to
      ? formatDayLabel(report.from)
      : `${formatDayLabel(report.from)} – ${formatDayLabel(report.to)}`;
  const rows = view === "service" ? report.byService : report.byStaff;
  const top = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <div className={`revenue-report ${pending ? "is-loading" : ""}`}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> ОРЛОГЫН ТАЙЛАН
          </div>
          <h1>
            Тайлан<span className="heading-dot">.</span>
          </h1>
          <p>
            {branchName} · {range}
          </p>
        </div>
      </div>
      <div className="report-filters">
        <div className="segmented" role="group" aria-label="Хугацаа сонгох">
          {presets().map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={p.from === report.from && p.to === report.to}
              onClick={() => go({ from: p.from, to: p.to })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="field">
          Эхлэх
          <input
            type="date"
            value={report.from}
            onChange={(e) => e.target.value && go({ from: e.target.value })}
          />
        </label>
        <label className="field">
          Дуусах
          <input
            type="date"
            value={report.to}
            min={report.from}
            onChange={(e) => e.target.value && go({ to: e.target.value })}
          />
        </label>
        <label className="field">
          Салбар
          <span className="select-wrap">
            <MapPin size={15} />
            <select
              value={report.branchId ?? ""}
              onChange={(e) => go({ branchId: e.target.value || undefined })}
            >
              <option value="">Бүх салбар</option>
              {branches
                .filter((b) => b.active)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <ChevronDown size={13} />
          </span>
        </label>
      </div>
      <section className="report-summary" aria-label="Орлогын үзүүлэлтүүд">
        <article className="report-hero">
          <span>Нийт орлого</span>
          <strong>{formatMnt(report.revenue)}</strong>
          <p>{range}</p>
        </article>
        {[
          ["Дууссан захиалга", String(report.completed)],
          ["Дундаж дүн", formatMnt(report.average)],
          ["Ирээгүй", String(report.noShow)],
          ["Цуцалсан", String(report.cancelled)],
        ].map(([title, value]) => (
          <article className="report-stat" key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="panel report-panel">
        <div className="report-panel-heading">
          <h2>
            {report.granularity === "day" ? "Өдрөөр" : "Сараар"}{" "}
            <span>
              {report.series.length}{" "}
              {report.granularity === "day" ? "өдөр" : "сар"}
            </span>
          </h2>
          <span className="chart-legend">
            <i className="legend-average" /> Дундаж{" "}
            {averageLabel(report.series)}
          </span>
        </div>
        <RevenueChart series={report.series} granularity={report.granularity} />
      </section>
      <section className="panel report-panel">
        <div className="report-panel-heading">
          <div className="report-breakdown-title">
            <h2>Задаргаа</h2>
            <div className="segmented" role="group" aria-label="Задаргаа">
              <button
                type="button"
                aria-pressed={view === "service"}
                onClick={() => setView("service")}
              >
                Үйлчилгээгээр
              </button>
              <button
                type="button"
                aria-pressed={view === "staff"}
                onClick={() => setView("staff")}
              >
                Ажилтнаар
              </button>
            </div>
          </div>
          <span className="chart-legend">
            {rows.length} мөр · {formatMnt(report.revenue)}
          </span>
        </div>
        {rows.length ? (
          <ul className="breakdown-list">
            {rows.map((r) => (
              <li key={r.key}>
                <div>
                  <strong>{r.name}</strong>
                  <span>{r.count} удаа</span>
                  <b>{formatMnt(r.revenue)}</b>
                </div>
                <span className="breakdown-track">
                  <span style={{ width: `${(r.revenue / top) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="report-empty">
            {preview
              ? "Танилцах горимд жишээ орлого харуулахгүй."
              : "Энэ хугацаанд дууссан захиалга алга."}
          </p>
        )}
      </section>
      <p className="report-note">
        Орлогыг «Дууссан» төлөвтэй захиалгын үнээр, захиалгын өдрөөр тооцно. Энэ
        нь төлбөрийн бүртгэл биш.
      </p>
    </div>
  );
}
