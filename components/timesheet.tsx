"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "./ui/button";
import { Feedback } from "./ui/feature-dialog";
import { addDays } from "@/lib/business-time";
import { userFacingError } from "@/lib/ui-language";
import { tone } from "@/lib/avatar";
import type { TimesheetData } from "@/lib/services/timesheet";
import type { BranchView } from "@/lib/admin-data";
type Status = "WORKED" | "OFF" | null;
const shortDays = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
function monthEnd(month: string) {
  return addDays(`${addDays(`${month}-28`, 4).slice(0, 7)}-01`, -1);
}
function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
// Cells cycle ✓ → А → · ; future days only allow А or empty.
function next(status: Status, future: boolean): Status {
  if (future) return status === "OFF" ? null : "OFF";
  return status === null ? "WORKED" : status === "WORKED" ? "OFF" : null;
}
const labels = { WORKED: "Ажилласан", OFF: "Амарсан" } as const;
export function Timesheet({
  data,
  branches,
  preview,
}: {
  data: TimesheetData;
  branches: BranchView[];
  preview: boolean;
}) {
  const router = useRouter();
  const [loading, start] = useTransition();
  const [marks, setMarks] = useState(
    () =>
      new Map<string, Status>(
        data.marks.map((m) => [`${m.staffId}|${m.date}`, m.status]),
      ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const month = data.from.slice(0, 7),
    end = monthEnd(month);
  const half =
    data.from.slice(8) === "01" && data.to === end
      ? "all"
      : data.to === `${month}-15`
        ? "first"
        : "second";
  const days: string[] = [];
  for (let d = data.from; d <= data.to; d = addDays(d, 1)) days.push(d);
  const go = (next: {
    month?: string;
    half?: string;
    branchId?: string | null;
  }) => {
    const m = next.month ?? month,
      h = next.half ?? half,
      last = monthEnd(m);
    const query = new URLSearchParams({
      from: h === "second" ? `${m}-16` : `${m}-01`,
      to: h === "first" ? `${m}-15` : last,
    });
    const branch = next.branchId === undefined ? data.branchId : next.branchId;
    if (branch) query.set("branchId", branch);
    start(() => router.push(`/timesheet?${query}`));
  };
  const status = (staffId: string, date: string) =>
    (marks.get(`${staffId}|${date}`) ?? null) as Status;
  async function save(
    staffId: string,
    date: string,
    value: Status,
    confirm = false,
  ) {
    const key = `${staffId}|${date}`,
      before = status(staffId, date);
    setBusy(key);
    setError("");
    setMarks((m) => new Map(m).set(key, value));
    try {
      const response = await fetch("/api/timesheet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, date, status: value, confirm }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409 && value === "OFF" && !confirm) {
        setMarks((m) => new Map(m).set(key, before));
        if (window.confirm(`${result.error}\n\nАмралт тэмдэглэх үү?`))
          return save(staffId, date, value, true);
        return;
      }
      if (!response.ok) throw new Error(result.error);
    } catch (e) {
      setMarks((m) => new Map(m).set(key, before));
      setError(userFacingError(e, "Тэмдэглэж чадсангүй. Дахин оролдоно уу."));
    } finally {
      setBusy(null);
    }
  }
  const totals = (staffId: string) => {
    let worked = 0,
      off = 0;
    for (const d of days) {
      const s = status(staffId, d);
      if (s === "WORKED") worked++;
      if (s === "OFF") off++;
    }
    return { worked, off };
  };
  const all = data.staff.reduce(
    (sum, s) => {
      const t = totals(s.id);
      return { worked: sum.worked + t.worked, off: sum.off + t.off };
    },
    { worked: 0, off: 0 },
  );
  function downloadCsv() {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      [
        "Ажилтан",
        "Салбар",
        ...days.map((d) => d.slice(5)),
        "Ажилласан",
        "Амарсан",
      ],
      ...data.staff.map((s) => {
        const t = totals(s.id);
        return [
          s.name,
          s.branches.join(", "),
          ...days.map((d) => {
            const v = status(s.id, d);
            return v === "WORKED" ? "✓" : v === "OFF" ? "А" : "";
          }),
          String(t.worked),
          String(t.off),
        ];
      }),
    ];
    // The BOM lets Excel open Cyrillic UTF-8 correctly.
    const blob = new Blob(
      ["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
      {
        type: "text/csv;charset=utf-8",
      },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tsagiin-burtgel-${data.from}-${data.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  const active = branches.filter((b) => b.active);
  const [y, m] = month.split("-").map(Number);
  return (
    <div className={`timesheet ${loading ? "is-loading" : ""}`}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">БАГ</div>
          <h1>
            Цагийн бүртгэл<span className="heading-dot">.</span>
          </h1>
          <p>
            {data.from.replace(/-/g, ".")} –{" "}
            {data.to.slice(5).replace("-", ".")} · {all.worked} ажилласан ·{" "}
            {all.off} амарсан
          </p>
        </div>
        <div className="heading-controls">
          <Button
            variant="outline"
            onClick={downloadCsv}
            disabled={!data.staff.length}
          >
            <Download size={14} /> Хүснэгт татах
          </Button>
        </div>
      </div>
      <div className="timesheet-toolbar">
        <div className="month-switch">
          <button
            type="button"
            className="icon-button"
            aria-label="Өмнөх сар"
            onClick={() => go({ month: shiftMonth(month, -1) })}
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <strong>
              {y} оны {m} сар
            </strong>
            <span>
              {data.from.replace(/-/g, ".")} –{" "}
              {data.to.slice(5).replace("-", ".")}
            </span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Дараагийн сар"
            onClick={() => go({ month: shiftMonth(month, 1) })}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Хугацаа">
          {(
            [
              ["all", "Бүтэн сар"],
              ["first", "1–15"],
              ["second", `16–${Number(end.slice(8))}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={half === value}
              onClick={() => go({ half: value })}
            >
              {label}
            </button>
          ))}
        </div>
        {active.length > 1 && (
          <div className="segmented" role="group" aria-label="Салбар">
            <button
              type="button"
              aria-pressed={!data.branchId}
              onClick={() => go({ branchId: null })}
            >
              Бүх салбар
            </button>
            {active.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={data.branchId === b.id}
                onClick={() => go({ branchId: b.id })}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
        <div className="timesheet-legend" aria-hidden="true">
          <span>
            <i className="mark worked">✓</i> Ажилласан
          </span>
          <span>
            <i className="mark off">А</i> Амарсан
          </span>
          <span>
            <i className="mark empty">·</i> Тэмдэглээгүй
          </span>
        </div>
      </div>
      <Feedback error={error} message="" />
      {data.staff.length ? (
        <div className="panel timesheet-table-wrap">
          <table className="timesheet-table">
            <thead>
              <tr>
                <th scope="col" className="ts-name">
                  Ажилтан
                </th>
                {days.map((d) => {
                  const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
                  return (
                    <th
                      key={d}
                      scope="col"
                      className={`${weekday === 0 || weekday === 6 ? "weekend" : ""} ${
                        d === data.today ? "today" : ""
                      }`}
                    >
                      {Number(d.slice(8))}
                      <small>{shortDays[weekday]}</small>
                    </th>
                  );
                })}
                <th scope="col" className="ts-total">
                  Нийт
                </th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((s) => {
                const t = totals(s.id);
                return (
                  <tr key={s.id}>
                    <th scope="row" className="ts-name">
                      <span className={`ts-dot tone-${tone(s.id)}`} />
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {[s.branches.join(", "), s.title]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                    </th>
                    {days.map((d) => {
                      const v = status(s.id, d),
                        key = `${s.id}|${d}`,
                        future = d > data.today;
                      const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
                      return (
                        <td
                          key={d}
                          className={
                            weekday === 0 || weekday === 6 ? "weekend" : ""
                          }
                        >
                          <button
                            type="button"
                            className={`mark ${v === "WORKED" ? "worked" : v === "OFF" ? "off" : "empty"}`}
                            disabled={preview || busy === key}
                            aria-label={`${s.name}, ${d}: ${v ? labels[v] : "Тэмдэглээгүй"}`}
                            onClick={() => save(s.id, d, next(v, future))}
                          >
                            {v === "WORKED" ? "✓" : v === "OFF" ? "А" : "·"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="ts-total">
                      <strong>{t.worked} өдөр</strong>
                      <small>{t.off} амралт</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="panel empty-page">
          <h2>Ажилтан алга</h2>
          <p>Ажилтан нэмсний дараа цагийн бүртгэл энд харагдана.</p>
        </section>
      )}
      <p className="timesheet-help">
        <strong>Нүд дээр дарж солино:</strong> ✓ Ажилласан → А Амарсан → ·
        Тэмдэглээгүй. Ирэх өдрүүдэд зөвхөн «А» тавина. <strong>А</strong> гэж
        тэмдэглэсэн ажилтан тэр өдөр шинэ захиалга авахгүй. Одоо байгаа захиалга
        хэвээр үлдэх тул өөр ажилтан эсвэл цаг руу шилжүүлнэ үү.
      </p>
    </div>
  );
}
