"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import type { BookingOptions, BookingDraft } from "./booking-wizard";
import { QuickBooking, formatDuration } from "./quick-booking";
import type { ScheduleData } from "@/lib/services/staff";
import type { BookingView } from "@/lib/services/bookings";
import {
  statusLabels,
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
import { tone, initials } from "@/lib/avatar";
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
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(0),
    [creating, setCreating] = useState<BookingDraft | null>(null),
    [selected, setSelected] = useState<BookingView | null>(null),
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
  const gridRef = useRef<HTMLElement>(null);
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
      ...branchStaff.map((s) => ({ id: s.id, name: s.name })),
      ...[
        ...new Map(
          dayRows
            .filter((b) => !branchStaff.some((s) => s.id === b.staffId))
            .map((b) => [b.staffId, { id: b.staffId, name: b.staffName }]),
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
    completed = active
      .filter((b) => b.status === "COMPLETED")
      .reduce((sum, b) => sum + b.priceMnt, 0),
    cancelled = (days === 1 ? dayRows : rows).filter(
      (b) => b.status === "CANCELLED",
    ).length;
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
              {mode === "calendar" ? "Календар" : "Захиалгууд"}
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
            <dt>Дууссан</dt>
            <dd>{formatMnt(completed)}</dd>
          </div>
          <div>
            <dt>Цуцлагдсан</dt>
            <dd>{cancelled}</dd>
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
      {loading ? (
        <section className="panel empty-page" role="status">
          Захиалгуудыг ачаалж байна…
        </section>
      ) : days === 1 ? (
        <section className="panel day-grid-panel" ref={gridRef}>
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
                      {initials(s.name)}
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
                <div className="staff-column" key={s.id}>
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
                    .filter((b) => b.staffId === s.id)
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
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`booking-card grid-booking tone-${tone(b.serviceId)} status-${b.status.toLowerCase()} ${density}`}
                          style={{
                            top: (from - start) * ppm + 1,
                            height: Math.max(to - from, 15) * ppm - 3,
                          }}
                          onClick={() => openBooking(b)}
                        >
                          <span className="grid-booking-time">
                            {timeRange(b)}
                          </span>
                          <strong>{b.customerName}</strong>
                          <span className="grid-booking-service">
                            {b.serviceName}
                          </span>
                          <span className="grid-booking-foot">
                            {b.status !== "CONFIRMED" && (
                              <em>{statusLabels[b.status]}</em>
                            )}
                            <b>{formatMnt(b.priceMnt)}</b>
                          </span>
                        </button>
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
                (b) => localStamp(b.startAt).slice(0, 10) === day,
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
                        className={`booking-card tone-${tone(b.serviceId)} status-${b.status.toLowerCase()}`}
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
        <span>
          Дууссан <b>{formatMnt(completed)}</b> · Үлдэгдэл{" "}
          <b className="due">{formatMnt(total - completed)}</b>
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
        open={!!selected}
        title="Захиалгын дэлгэрэнгүй"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <Feedback error={error} />
            <div className="booking-summary">
              <h3>{selected.customerName}</h3>
              <p>{selected.customerPhone}</p>
              <p>
                {selected.serviceName} · {selected.durationMinutes} минут ·{" "}
                {formatMnt(selected.priceMnt)}
              </p>
              <p>
                {selected.staffName} · {selected.branchName}
              </p>
              <strong>
                {localStamp(selected.startAt).replace("T", " ")} —{" "}
                {localStamp(selected.endAt).slice(11)}
              </strong>
              <p>
                {statusLabels[selected.status]} ·{" "}
                {sourceLabels[selected.source]}
              </p>
              {selected.notes && <p>{selected.notes}</p>}
              <Link
                className="text-link"
                href={`/customers?id=${selected.customerId}`}
              >
                Үйлчлүүлэгчийн түүх
              </Link>
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
          </>
        )}
      </FeatureDialog>
    </>
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
