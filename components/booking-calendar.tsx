"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Check,
  Link2,
  Star,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import type { BookingOptions, BookingDraft } from "./booking-wizard";
import { QuickBooking, formatDuration } from "./quick-booking";
import type { ScheduleData } from "@/lib/services/staff";
import type { BookingView } from "@/lib/services/bookings";
import {
  statusLabels,
  paymentLabels,
  sourceLabels,
  transitions,
} from "@/lib/booking-validation";
import { localStamp, addDays, localInstant } from "@/lib/business-time";
import {
  formatDayLabel,
  formatMnt,
  userFacingError,
  weekdayName,
} from "@/lib/ui-language";
import { requestJson } from "@/lib/client-request";
import { tone, toneAt, initials } from "@/lib/avatar";
// Day grid geometry: the whole day is scaled to fit the viewport, but never
// below MIN_PX_PER_MINUTE so short appointments stay readable.
const MIN_PX_PER_MINUTE = 0.7,
  MAX_PX_PER_MINUTE = 1.6,
  DAY_START = 8 * 60,
  DAY_END = 21 * 60,
  STEP = 30;
function minuteOf(value: string) {
  const [h, m] = localStamp(value).slice(11).split(":").map(Number);
  return h * 60 + m;
}
function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
const billable = (b: BookingView) =>
  b.status !== "CANCELLED" && b.status !== "NO_SHOW";
// "Цуцалсан: Сараа · 10/16 14:20", or the customer, or the pending expiry.
function cancelledBy(b: BookingView) {
  const when = b.cancelledAt
    ? ` · ${formatDayLabel(localStamp(b.cancelledAt).slice(0, 10), false)} ${localStamp(b.cancelledAt).slice(11)}`
    : "";
  if (b.cancelSource === "CUSTOMER") return `Үйлчлүүлэгч өөрөө цуцалсан${when}`;
  if (b.cancelSource === "EXPIRED")
    return `Хугацаандаа баталгаажаагүй тул автоматаар цуцлагдсан${when}`;
  if (b.cancelledByName) return `Цуцалсан: ${b.cancelledByName}${when}`;
  return "Цуцалсан хүн бүртгэгдээгүй";
}
function timeRange(b: BookingView) {
  return `${localStamp(b.startAt).slice(11)} — ${localStamp(b.endAt).slice(11)}`;
}
// Visible ranges outside shifts and inside breaks, for grey shading.
function shade(
  plan: { windows: number[][]; breaks: number[][] },
  start: number,
  end: number,
) {
  const closed: [number, number][] = [];
  let cursor = start;
  for (const [a, b] of [...plan.windows].sort((x, y) => x[0] - y[0])) {
    if (a > cursor) closed.push([cursor, Math.min(a, end)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < end) closed.push([cursor, end]);
  for (const [a, b] of plan.breaks)
    if (b > start && a < end)
      closed.push([Math.max(a, start), Math.min(b, end)]);
  return closed.filter(([a, b]) => b > a);
}
export function BookingCalendar({
  options,
  preview,
  mode,
}: {
  options: BookingOptions;
  preview: boolean;
  mode: "calendar" | "bookings";
}) {
  const today = localStamp(new Date()).slice(0, 10);
  const [date, setDate] = useState(today),
    [days, setDays] = useState(1),
    [branch, setBranch] = useState(options.branches[0]?.id ?? ""),
    [rows, setRows] = useState<BookingView[]>([]),
    [loading, setLoading] = useState(!preview),
    // After the first load, refreshes keep the grid on screen (and its
    // scroll) instead of swapping it for a loading message.
    [ready, setReady] = useState(preview),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(0),
    [creating, setCreating] = useState<BookingDraft | null>(null),
    [selected, setSelected] = useState<BookingView | null>(null),
    [showCancelled, setShowCancelled] = useState(false),
    [pending, setPending] = useState(false),
    [now, setNow] = useState(() => minuteOf(new Date().toISOString())),
    [schedule, setSchedule] = useState<ScheduleData | null>(null),
    [ppm, setPpm] = useState(1);
  useEffect(() => {
    const timer = setInterval(
      () => setNow(minuteOf(new Date().toISOString())),
      60000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) setLoading(true);
    });
    const q = new URLSearchParams({
      date,
      days: String(days),
      ...(branch ? { branchId: branch } : {}),
    });
    fetch(`/api/bookings?${q}`, { signal: controller.signal })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setRows(b);
        setReady(true);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(userFacingError(e, "Захиалгуудыг ачаалж чадсангүй."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, days, branch, refresh, preview]);
  // Working hours and time off shade the grid; roles without access just see a plain grid.
  useEffect(() => {
    if (preview || !branch) return;
    const controller = new AbortController();
    fetch(`/api/time-off?branchId=${encodeURIComponent(branch)}`, {
      signal: controller.signal,
    })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!controller.signal.aborted) setSchedule(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSchedule(null);
      });
    return () => controller.abort();
  }, [branch, refresh, preview]);
  // Every booking gets its own colour, handed out in time order so
  // neighbours differ; a visit's bookings (one customer, two services at
  // once) share one.
  const visitKey = (b: BookingView) => b.groupId ?? b.id;
  const bookingTones = new Map<string, string>();
  for (const b of [...rows].sort(
    (x, y) => x.startAt.localeCompare(y.startAt) || x.id.localeCompare(y.id),
  ))
    if (!bookingTones.has(visitKey(b)))
      bookingTones.set(visitKey(b), toneAt(bookingTones.size));
  const bookingTone = (b: BookingView) =>
    bookingTones.get(visitKey(b)) ?? tone(b.id);
  const gridRef = useRef<HTMLElement>(null);
  // Where inside a booking card the pointer grabbed it, so a drop keeps the
  // card's top under the same spot.
  const grab = useRef(0);
  const movable = (b: BookingView) =>
    !preview && ["PENDING", "CONFIRMED"].includes(b.status);
  async function quickChange(
    b: BookingView,
    body: Record<string, unknown>,
    done: string,
  ) {
    setError("");
    setMessage("");
    try {
      await requestJson(`/api/bookings?id=${b.id}`, "PATCH", {
        ...body,
        version: b.version,
      });
      setMessage(done);
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(userFacingError(e, "Захиалгыг өөрчилж чадсангүй."));
    }
  }
  // Dropping a card on a staff column moves it to that person and time.
  function drop(staff: { id: string; name: string }, e: React.DragEvent) {
    e.preventDefault();
    const b = dayRows.find(
      (r) => r.id === e.dataTransfer.getData("text/plain"),
    );
    if (!b) return;
    const top = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minute = Math.max(
      start,
      Math.round((start + (top - grab.current) / ppm) / 15) * 15,
    );
    if (staff.id === b.staffId && minute === minuteOf(b.startAt)) return;
    if (b.staffLocked && staff.id !== b.staffId) {
      setMessage("");
      setError(
        `${b.customerName} зөвхөн ${b.staffName}-д үйлчлүүлэхийг хүссэн тул өөр ажилтан руу шилжүүлэх боломжгүй.`,
      );
      return;
    }
    if (
      !window.confirm(
        `${b.customerName}-ийн захиалгыг ${staff.name} · ${clock(minute)} руу шилжүүлэх үү? Үйлчлүүлэгчид мэдэгдэл очно.`,
      )
    )
      return;
    quickChange(
      b,
      {
        action: "reschedule",
        staffId: staff.id,
        startAt: localInstant(`${date}T${clock(minute)}`).toISOString(),
      },
      "Захиалгыг шилжүүллээ.",
    );
  }
  async function transition(status: string) {
    if (!selected) return;
    if (
      !window.confirm(`Захиалгын төлөвийг «${statusLabels[status]}» болгох уу?`)
    )
      return;
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/bookings?id=${selected.id}`, "PATCH", {
        action: "status",
        status,
        version: selected.version,
      });
      setSelected(null);
      setMessage("Захиалгын төлөвийг шинэчиллээ.");
      setRefresh(refresh + 1);
    } catch (e) {
      setError(userFacingError(e, "Захиалгыг өөрчилж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  const dayRows = rows.filter(
      (b) => localStamp(b.startAt).slice(0, 10) === date,
    ),
    branchStaff = options.staff.filter(
      (s) => !branch || s.branchIds.includes(branch),
    ),
    // Bookings may still reference staff who left the branch; keep their column.
    columns = [
      ...branchStaff.map((s) => ({
        id: s.id,
        name: s.name,
        imageUrl: s.imageUrl ?? null,
      })),
      ...[
        ...new Map(
          dayRows
            .filter((b) => !branchStaff.some((s) => s.id === b.staffId))
            .map((b) => [
              b.staffId,
              { id: b.staffId, name: b.staffName, imageUrl: null },
            ]),
        ).values(),
      ],
    ],
    weekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1,
    shifts = (schedule?.hours ?? []).filter(
      (h) =>
        h.branchId === branch &&
        h.dayOfWeek === weekday &&
        h.active &&
        columns.some((c) => c.id === h.staffId),
    ),
    // Show only the salon's working day when shifts are known.
    start = Math.min(
      shifts.length
        ? Math.floor(Math.min(...shifts.map((h) => h.startMinute)) / 60) * 60
        : DAY_START,
      ...dayRows.map((b) => Math.floor(minuteOf(b.startAt) / 60) * 60),
    ),
    end = Math.max(
      shifts.length
        ? Math.ceil(Math.max(...shifts.map((h) => h.endMinute)) / 60) * 60
        : DAY_END,
      ...dayRows.map((b) =>
        localStamp(b.endAt).slice(0, 10) > date
          ? 1440
          : Math.ceil(minuteOf(b.endAt) / 60) * 60,
      ),
    ),
    marks = Array.from(
      { length: (end - start) / STEP },
      (_, i) => start + i * STEP,
    ),
    dayStart = +localInstant(`${date}T00:00`),
    plans = new Map(
      columns.map((s) => {
        const shifts = (schedule?.hours ?? []).filter(
            (h) =>
              h.staffId === s.id &&
              h.branchId === branch &&
              h.dayOfWeek === weekday &&
              h.active,
          ),
          off = (schedule?.timeOff ?? [])
            .filter(
              (t) =>
                t.staffId === s.id &&
                +new Date(t.startsAt) < dayStart + 86400000 &&
                +new Date(t.endsAt) > dayStart,
            )
            .map((t) => ({
              from: Math.max(0, (+new Date(t.startsAt) - dayStart) / 60000),
              to: Math.min(1440, (+new Date(t.endsAt) - dayStart) / 60000),
              reason: t.reason ?? "",
            })),
          windows = shifts.map((h) => [h.startMinute, h.endMinute]),
          breaks = shifts.flatMap((h) =>
            h.breaks.map((b) => [b.startMinute, b.endMinute]),
          );
        // Minutes inside a shift, outside breaks and time off.
        let open = 0;
        for (let m = 0; m < 1440; m += 5)
          if (
            windows.some(([a, b]) => m >= a && m < b) &&
            !breaks.some(([a, b]) => m >= a && m < b) &&
            !off.some((o) => m >= o.from && m < o.to)
          )
            open += 5;
        return [s.id, { windows, breaks, off, open }] as const;
      }),
    ),
    workMinutes = [...plans.values()].reduce((sum, p) => sum + p.open, 0),
    bookedMinutes = dayRows
      .filter(billable)
      .reduce((sum, b) => sum + b.durationMinutes, 0),
    showNow = date === today && now >= start && now <= end,
    active = (days === 1 ? dayRows : rows).filter(billable),
    total = active.reduce((sum, b) => sum + b.priceMnt, 0),
    // Paid means a payment method was recorded, whatever the status.
    paid = active
      .filter((b) => b.paymentMethod)
      .reduce((sum, b) => sum + b.priceMnt, 0),
    // Cancelled bookings leave the grid; they are listed on demand.
    cancelledRows = (days === 1 ? dayRows : rows).filter(
      (b) => b.status === "CANCELLED",
    ),
    cancelled = cancelledRows.length;
  // Fit the visible hours between the grid's top edge and the bottom of the window.
  const footerRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    function fit() {
      const panel = gridRef.current;
      if (!panel) return;
      const head = panel.querySelector<HTMLElement>(".staff-head"),
        free =
          window.innerHeight -
          (panel.getBoundingClientRect().top + window.scrollY) -
          (head?.offsetHeight ?? 60) -
          (footerRef.current?.offsetHeight ?? 50) -
          24;
      setPpm(
        Math.min(
          MAX_PX_PER_MINUTE,
          Math.max(MIN_PX_PER_MINUTE, free / (end - start)),
        ),
      );
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [start, end, loading, days, columns.length, message, error, preview]);
  function openBooking(b: BookingView) {
    setError("");
    setSelected(b);
  }
  return (
    <>
      <div className="calendar-topbar">
        <div className="calendar-date-nav">
          <Button
            variant="outline"
            size="sm"
            disabled={date === today}
            onClick={() => setDate(today)}
          >
            Өнөөдөр
          </Button>
          <button
            type="button"
            className="icon-button"
            aria-label="Өмнөх өдрүүд"
            onClick={() => setDate(addDays(date, -days))}
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="calendar-date-title">
            <span>{date.split("-").reverse().join(" / ")}</span>
            <small>{weekdayName(date)}</small>
            <span className="sr-only">
              {mode === "calendar" ? "Календарь" : "Захиалгууд"}
            </span>
          </h1>
          <button
            type="button"
            className="icon-button"
            aria-label="Дараах өдрүүд"
            onClick={() => setDate(addDays(date, days))}
          >
            <ChevronRight size={18} />
          </button>
          <input
            className="calendar-date-input"
            type="date"
            aria-label="Өдөр"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Шинэчлэх"
            onClick={() => setRefresh(refresh + 1)}
          >
            <RotateCw size={15} />
          </button>
        </div>
        <Button
          disabled={preview}
          onClick={() => setCreating({ branchId: branch, date })}
        >
          <Plus size={14} />
          Шинэ захиалга
        </Button>
      </div>
      {preview && (
        <div className="notice">
          Та танилцах горимд байна. Захиалга үүсгэхийн тулд салоноо бүртгэнэ үү.
        </div>
      )}
      {!selected && <Feedback error={error} message={message} />}
      <div className="calendar-stats">
        {options.branches.length > 1 && (
          <div className="branch-tabs" role="tablist" aria-label="Салбар">
            {options.branches.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={branch === b.id}
                onClick={() => setBranch(b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
        <dl>
          <div>
            <dt>Захиалга</dt>
            <dd>{active.length}</dd>
          </div>
          <div>
            <dt>Ажилтан</dt>
            <dd>{columns.length}</dd>
          </div>
          {days === 1 && schedule && workMinutes > 0 && (
            <>
              <div>
                <dt>Ачаалал</dt>
                <dd>
                  {Math.min(
                    100,
                    Math.round((bookedMinutes / workMinutes) * 100),
                  )}
                  %
                </dd>
              </div>
              <div>
                <dt>Чөлөөт цаг</dt>
                <dd>
                  {formatDuration(
                    Math.max(
                      0,
                      Math.round((workMinutes - bookedMinutes) / 30) * 30,
                    ),
                  ) || "0ц"}
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>Төлсөн</dt>
            <dd>{formatMnt(paid)}</dd>
          </div>
          <div>
            <dt>Цуцлагдсан</dt>
            <dd>
              <button
                type="button"
                className="stat-link"
                disabled={!cancelled}
                onClick={() => setShowCancelled(true)}
              >
                {cancelled}
              </button>
            </dd>
          </div>
        </dl>
        <div className="view-toggle" role="group" aria-label="Харагдац">
          {[
            [1, "Өдөр"],
            [7, "7 хоног"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={days === value}
              onClick={() => setDays(value as number)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {loading && !ready ? (
        <section className="panel empty-page" role="status">
          Захиалгуудыг ачаалж байна…
        </section>
      ) : days === 1 ? (
        <section
          className={`panel day-grid-panel ${loading ? "is-refreshing" : ""}`}
          ref={gridRef}
          aria-busy={loading}
        >
          {columns.length ? (
            <div
              className="day-grid"
              style={
                {
                  "--columns": columns.length,
                  "--grid-height": `${(end - start) * ppm}px`,
                } as React.CSSProperties
              }
            >
              <div className="day-grid-corner" />
              {columns.map((s) => {
                const own = dayRows.filter((b) => b.staffId === s.id);
                return (
                  <div className="staff-head" key={s.id}>
                    <span className={`staff-avatar tone-${tone(s.id)}`}>
                      {s.imageUrl ? (
                        <Image
                          src={s.imageUrl}
                          alt=""
                          fill
                          unoptimized
                          sizes="36px"
                        />
                      ) : (
                        initials(s.name)
                      )}
                    </span>
                    <div>
                      <strong>{s.name}</strong>
                      <small>
                        {own.filter(billable).length} захиалга ·{" "}
                        {formatMnt(
                          own
                            .filter(billable)
                            .reduce((sum, b) => sum + b.priceMnt, 0),
                        )}
                      </small>
                    </div>
                  </div>
                );
              })}
              <div className="time-axis">
                {marks.map((m) => (
                  <span
                    key={m}
                    className={
                      m % 60 ? (STEP * ppm < 24 ? "half hidden" : "half") : ""
                    }
                    style={{ top: (m - start) * ppm }}
                  >
                    {clock(m)}
                  </span>
                ))}
                {showNow && (
                  <b className="now-label" style={{ top: (now - start) * ppm }}>
                    {clock(now)}
                  </b>
                )}
              </div>
              {columns.map((s) => (
                <div
                  className="staff-column"
                  key={s.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => drop(s, e)}
                >
                  {schedule &&
                    shade(plans.get(s.id)!, start, end).map(([a, b]) => (
                      <div
                        key={`shade-${a}`}
                        className="grid-closed"
                        aria-hidden
                        style={{
                          top: (a - start) * ppm,
                          height: (b - a) * ppm,
                        }}
                      />
                    ))}
                  {plans.get(s.id)?.off.map((o) => (
                    <div
                      key={`off-${o.from}`}
                      className="grid-off"
                      style={{
                        top: (Math.max(o.from, start) - start) * ppm,
                        height:
                          (Math.min(o.to, end) - Math.max(o.from, start)) * ppm,
                      }}
                    >
                      <span>
                        Чөлөө
                        {o.to - o.from < 1440 &&
                          ` · ${clock(o.from)} — ${clock(o.to)}`}
                      </span>
                      {o.reason && <small>{o.reason}</small>}
                    </div>
                  ))}
                  {marks.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="grid-slot"
                      disabled={preview}
                      aria-label={`${s.name} · ${clock(m)} цагт захиалга нэмэх`}
                      style={{
                        top: (m - start) * ppm,
                        height: STEP * ppm,
                      }}
                      onClick={() =>
                        setCreating({
                          branchId: branch,
                          staffId: s.id,
                          date,
                          time: clock(m),
                        })
                      }
                    />
                  ))}
                  {dayRows
                    .filter(
                      (b) => b.staffId === s.id && b.status !== "CANCELLED",
                    )
                    .map((b) => {
                      const from = Math.max(minuteOf(b.startAt), start),
                        to =
                          localStamp(b.endAt).slice(0, 10) > date
                            ? 1440
                            : minuteOf(b.endAt),
                        px = Math.max(to - from, 15) * ppm,
                        density =
                          px < 34
                            ? "compact"
                            : px < 56
                              ? "mini"
                              : px < 86
                                ? "tight"
                                : "";
                      const confirmed = ["CONFIRMED", "COMPLETED"].includes(
                        b.status,
                      );
                      return (
                        <div
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          draggable={movable(b)}
                          onDragStart={(e) => {
                            grab.current =
                              e.clientY -
                              e.currentTarget.getBoundingClientRect().top;
                            e.dataTransfer.setData("text/plain", b.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className={`booking-card grid-booking tone-${bookingTone(b)} status-${b.status.toLowerCase()} ${density}`}
                          style={{
                            top: (from - start) * ppm + 1,
                            height: Math.max(to - from, 15) * ppm - 3,
                          }}
                          onClick={() => openBooking(b)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openBooking(b);
                            }
                          }}
                        >
                          <span className="grid-booking-top">
                            <span className="grid-booking-time">
                              {timeRange(b)}
                            </span>
                            {b.groupId && (
                              <Link2
                                size={12}
                                className="grid-booking-group"
                                aria-label="Хамт захиалсан үйлчилгээ"
                              />
                            )}
                            <b
                              className={`grid-booking-price ${b.paymentMethod ? "paid" : "unpaid"}`}
                              title={
                                b.paymentMethod
                                  ? `Төлсөн · ${paymentLabels[b.paymentMethod]}`
                                  : "Төлөөгүй"
                              }
                            >
                              {formatMnt(b.priceMnt)}
                            </b>
                            <button
                              type="button"
                              className={`booking-check ${confirmed ? "on" : ""}`}
                              disabled={preview || b.status !== "PENDING"}
                              aria-label={
                                confirmed ? "Баталгаажсан" : "Баталгаажуулах"
                              }
                              title={
                                confirmed
                                  ? "Баталгаажсан"
                                  : "Дарж баталгаажуулна"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                quickChange(
                                  b,
                                  { action: "status", status: "CONFIRMED" },
                                  "Захиалгыг баталгаажууллаа.",
                                );
                              }}
                            >
                              {confirmed && <Check size={11} strokeWidth={3} />}
                            </button>
                          </span>
                          <strong>
                            <button
                              type="button"
                              className={`booking-star ${b.staffLocked ? "on" : ""}`}
                              disabled={!movable(b)}
                              aria-pressed={b.staffLocked}
                              aria-label="Зөвхөн энэ ажилтан"
                              title={
                                b.staffLocked
                                  ? "Зөвхөн энэ ажилтан үйлчилнэ"
                                  : "Од тавивал өөр ажилтан руу шилжихгүй"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                quickChange(
                                  b,
                                  { action: "lock", locked: !b.staffLocked },
                                  b.staffLocked
                                    ? "Одыг авлаа."
                                    : "Зөвхөн энэ ажилтан үйлчилнэ.",
                                );
                              }}
                            >
                              <Star size={12} />
                            </button>
                            {b.customerName}
                          </strong>
                          <span className="grid-booking-service">
                            {b.serviceName}
                          </span>
                          {!["PENDING", "CONFIRMED"].includes(b.status) && (
                            <span className="grid-booking-foot">
                              <em>{statusLabels[b.status]}</em>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  {showNow && (
                    <div
                      className="now-line"
                      style={{ top: (now - start) * ppm }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-page">
              Энэ салбарт ажилтан алга. Эхлээд ажилтан нэмнэ үү.
            </p>
          )}
        </section>
      ) : (
        <div className="booking-calendar week-view">
          {Array.from({ length: days }, (_, i) => addDays(date, i)).map(
            (day) => {
              const list = rows.filter(
                (b) =>
                  localStamp(b.startAt).slice(0, 10) === day &&
                  b.status !== "CANCELLED",
              );
              return (
                <section
                  className={`panel calendar-day ${day === today ? "today" : ""}`}
                  key={day}
                >
                  <h2>
                    <button
                      type="button"
                      onClick={() => {
                        setDate(day);
                        setDays(1);
                      }}
                    >
                      {formatDayLabel(day)}
                    </button>
                  </h2>
                  {list.length ? (
                    list.map((b) => (
                      <button
                        className={`booking-card tone-${bookingTone(b)} status-${b.status.toLowerCase()}`}
                        key={b.id}
                        type="button"
                        onClick={() => openBooking(b)}
                      >
                        <span className="grid-booking-time">
                          {timeRange(b)}
                        </span>
                        <strong>{b.customerName}</strong>
                        <span className="grid-booking-service">
                          {b.serviceName}
                        </span>
                        <small>{b.staffName}</small>
                        {b.status !== "CONFIRMED" && (
                          <span className="status-pill">
                            {statusLabels[b.status]}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="field-hint">Захиалга алга.</p>
                  )}
                </section>
              );
            },
          )}
        </div>
      )}
      <footer className="calendar-total" ref={footerRef}>
        <span>
          {days === 1 ? "Өдрийн нийт" : "7 хоногийн нийт"}{" "}
          <strong>{formatMnt(total)}</strong>
        </span>
        <span className="pay-legend" aria-hidden>
          <i className="paid" /> Төлсөн
          <i className="unpaid" /> Төлөөгүй
        </span>
        <span>
          Төлсөн <b>{formatMnt(paid)}</b> · Үлдэгдэл{" "}
          <b className="due">{formatMnt(total - paid)}</b>
        </span>
      </footer>
      <FeatureDialog
        open={!!creating}
        wide
        title="Шинэ захиалга"
        onClose={() => setCreating(null)}
      >
        {creating && (
          <QuickBooking
            options={options}
            initial={creating}
            onClose={() => setCreating(null)}
            onSaved={(b) => {
              setCreating(null);
              setDate(localStamp(b.startAt).slice(0, 10));
              if (b.branchId) setBranch(b.branchId);
              setMessage("Захиалга амжилттай нэмэгдлээ.");
              setRefresh(refresh + 1);
            }}
            onTimeOffSaved={(day) => {
              setCreating(null);
              setDate(day);
              setMessage("Чөлөөг бүртгэлээ.");
              setRefresh(refresh + 1);
            }}
          />
        )}
      </FeatureDialog>
      <FeatureDialog
        open={showCancelled}
        title="Цуцлагдсан захиалгууд"
        onClose={() => setShowCancelled(false)}
      >
        <ul className="cancelled-list">
          {cancelledRows.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  setShowCancelled(false);
                  openBooking(b);
                }}
              >
                <span>
                  <strong>{b.customerName}</strong>
                  <small>
                    {formatDayLabel(localStamp(b.startAt).slice(0, 10))} ·{" "}
                    {timeRange(b)} · {b.serviceName} · {b.staffName}
                  </small>
                </span>
                <em>{cancelledBy(b)}</em>
              </button>
            </li>
          ))}
        </ul>
      </FeatureDialog>
      <FeatureDialog
        open={!!selected}
        wide
        title="Захиалгын дэлгэрэнгүй"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="detail-body">
            <Feedback error={error} />
            <BookingDetail
              booking={selected}
              visit={
                selected.groupId
                  ? rows.filter((r) => r.groupId === selected.groupId)
                  : [selected]
              }
              onSaved={(done) => {
                setSelected(null);
                setMessage(done);
                setRefresh((r) => r + 1);
              }}
            />
            <div className="quick-section-head detail-actions-head">
              <h3>Төлөв</h3>
            </div>
            <div className="category-list">
              {transitions[selected.status].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => transition(status)}
                >
                  {
                    (
                      {
                        CONFIRMED: "Баталгаажуулах",
                        COMPLETED: "Дуусгах",
                        CANCELLED: "Цуцлах",
                        NO_SHOW: "Ирээгүй гэж тэмдэглэх",
                      } as Record<string, string>
                    )[status]
                  }
                </Button>
              ))}
            </div>
            {["PENDING", "CONFIRMED"].includes(selected.status) && (
              <Reschedule
                booking={selected}
                options={options}
                onSaved={(value) => {
                  setSelected(null);
                  setDate(localStamp(value.startAt).slice(0, 10));
                  setMessage("Захиалгын цагийг өөрчиллөө.");
                  setRefresh(refresh + 1);
                }}
              />
            )}
          </div>
        )}
      </FeatureDialog>
    </>
  );
}
// The booking as the desk form shows it: customer, the visit's services,
// time, and an editable payment box.
function BookingDetail({
  booking,
  visit,
  onSaved,
}: {
  booking: BookingView;
  visit: BookingView[];
  onSaved: (message: string) => void;
}) {
  // The visit's extra and payment live on its lead booking.
  const lead = [...visit].sort((a, b) => b.extraMnt - a.extraMnt)[0] ?? booking;
  const [extraOpen, setExtraOpen] = useState(lead.extraMnt > 0),
    [extra, setExtra] = useState(lead.extraMnt ? String(lead.extraMnt) : ""),
    [payment, setPayment] = useState(lead.paymentMethod ?? ""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const extraMnt = extraOpen ? Math.max(0, Math.round(Number(extra) || 0)) : 0,
    total = visit.reduce((sum, b) => sum + b.servicePriceMnt, 0) + extraMnt,
    changed =
      extraMnt !== lead.extraMnt || (payment || null) !== lead.paymentMethod,
    editable = ["PENDING", "CONFIRMED", "COMPLETED"].includes(booking.status);
  async function save() {
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/bookings?id=${lead.id}`, "PATCH", {
        action: "payment",
        paymentMethod: payment || null,
        extraMnt,
        version: lead.version,
      });
      onSaved(
        payment ? "Төлбөрийг бүртгэлээ." : "Төлбөрийн мэдээллийг шинэчиллээ.",
      );
    } catch (e) {
      setError(userFacingError(e, "Төлбөрийг хадгалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="booking-detail">
      <Feedback error={error} />
      <div className="quick-section">
        <h3>Үйлчлүүлэгч</h3>
        <div className="detail-customer">
          <strong>{booking.customerName}</strong>
          <a href={`tel:${booking.customerPhone}`}>{booking.customerPhone}</a>
          <Link
            className="text-link"
            href={`/customers?id=${booking.customerId}`}
          >
            Үйлчлүүлэгчийн түүх
          </Link>
        </div>
      </div>
      <div className="quick-section">
        <div className="quick-section-head">
          <h3>Үйлчилгээ</h3>
          <small>
            {statusLabels[booking.status]} · {sourceLabels[booking.source]}
          </small>
        </div>
        {booking.status === "CANCELLED" && (
          <p className="detail-cancelled" role="status">
            {cancelledBy(booking)}
          </p>
        )}
        <ul className="detail-services">
          {visit.map((b) => (
            <li key={b.id} data-current={b.id === booking.id || undefined}>
              <span>
                <strong>{b.serviceName}</strong>
                <small>
                  {b.staffName} · {formatDuration(b.durationMinutes)}
                </small>
              </span>
              <span>{timeRange(b)}</span>
            </li>
          ))}
        </ul>
        <p className="detail-when">
          {formatDayLabel(localStamp(booking.startAt).slice(0, 10))} ·{" "}
          {booking.branchName}
          {visit.length > 1 && " · Хоёр үйлчилгээ зэрэг"}
        </p>
      </div>
      <div className="quick-section quick-payment">
        <h3>Төлбөр</h3>
        {visit.map((b) => (
          <div className="pay-row" key={b.id}>
            <span>{b.serviceName}</span>
            <span>{formatMnt(b.servicePriceMnt)}</span>
          </div>
        ))}
        {extraOpen ? (
          <div className="pay-row pay-extra">
            <label htmlFor="detail-extra">Нэмэлт төлбөр</label>
            <span>
              <input
                id="detail-extra"
                type="number"
                min={0}
                max={100000000}
                step={1000}
                inputMode="numeric"
                placeholder="0"
                disabled={!editable}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
              {editable && (
                <button
                  type="button"
                  aria-label="Нэмэлт төлбөр хасах"
                  onClick={() => {
                    setExtraOpen(false);
                    setExtra("");
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </span>
          </div>
        ) : (
          editable && (
            <button
              type="button"
              className="add-extra"
              onClick={() => setExtraOpen(true)}
            >
              <Plus size={14} /> Нэмэлт төлбөр
            </button>
          )
        )}
        <div className="pay-row pay-total">
          <span>Нийт дүн</span>
          <strong>{formatMnt(total)}</strong>
        </div>
        <div
          className="chip-row pay-methods"
          role="group"
          aria-label="Төлбөрийн хэрэгсэл"
        >
          {(["POS", "TRANSFER", "CASH"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className="chip"
              disabled={!editable}
              aria-pressed={payment === m}
              onClick={() => setPayment(payment === m ? "" : m)}
            >
              {paymentLabels[m]}
            </button>
          ))}
        </div>
        <p className="pay-state">
          {lead.paymentMethod
            ? `Төлсөн · ${paymentLabels[lead.paymentMethod]}`
            : "Төлбөр хараахан ороогүй"}
        </p>
        {editable && changed && (
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "Хадгалж байна…" : "Төлбөр хадгалах"}
          </Button>
        )}
      </div>
      {booking.notes && (
        <div className="quick-section">
          <h3>Тэмдэглэл</h3>
          <p className="detail-notes">{booking.notes}</p>
        </div>
      )}
    </div>
  );
}
function Reschedule({
  booking,
  options,
  onSaved,
}: {
  booking: BookingView;
  options: BookingOptions;
  onSaved: (b: BookingView) => void;
}) {
  const [open, setOpen] = useState(false),
    [date, setDate] = useState(localStamp(booking.startAt).slice(0, 10)),
    [staffId, setStaff] = useState(booking.staffId),
    [slots, setSlots] = useState<{ startAt: string }[]>([]),
    [startAt, setStart] = useState(""),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open || !date) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setStart("");
      }
    });
    const q = new URLSearchParams({
      branchId: booking.branchId,
      serviceId: booking.serviceId,
      staffId,
      date,
      excludeBookingId: booking.id,
    });
    fetch(`/api/availability?${q}`, { signal: controller.signal })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setSlots(b.slots);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setSlots([]);
          setError(userFacingError(e, "Цагийг ачаалж чадсангүй."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, date, staffId, booking.id, booking.branchId, booking.serviceId]);
  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Цаг өөрчлөх
      </Button>
    );
  return (
    <section className="reschedule-form">
      <h3>Цаг өөрчлөх</h3>
      <Feedback error={error} />
      <label className="field">
        Шинэ өдөр
        <input
          type="date"
          value={date}
          min={localStamp(new Date()).slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="field">
        Шинэ ажилтан
        <select value={staffId} onChange={(e) => setStaff(e.target.value)}>
          {options.staff
            .filter(
              (s) =>
                s.branchIds.includes(booking.branchId) &&
                s.serviceIds.includes(booking.serviceId),
            )
            .map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      {loading ? (
        <p role="status">Боломжтой цагийг хайж байна…</p>
      ) : (
        <div className="slot-grid">
          {slots.map((s) => (
            <Button
              type="button"
              variant={startAt === s.startAt ? "default" : "outline"}
              key={s.startAt}
              onClick={() => setStart(s.startAt)}
            >
              {localStamp(s.startAt).slice(11)}
            </Button>
          ))}
          {!slots.length && <p>Боломжтой цаг алга.</p>}
        </div>
      )}
      <Button
        disabled={!startAt || loading || pending}
        onClick={async () => {
          setPending(true);
          try {
            const value = await requestJson<BookingView>(
              `/api/bookings?id=${booking.id}`,
              "PATCH",
              {
                action: "reschedule",
                staffId,
                startAt,
                version: booking.version,
              },
            );
            onSaved(value);
          } catch (e) {
            setError(userFacingError(e, "Цагийг өөрчилж чадсангүй."));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Хадгалж байна…" : "Шинэ цагийг хадгалах"}
      </Button>
    </section>
  );
}
