"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { BookingWizard, type BookingOptions } from "./booking-wizard";
import type { BookingView } from "@/lib/services/bookings";
import {
  statusLabels,
  sourceLabels,
  transitions,
} from "@/lib/booking-validation";
import { localStamp, addDays } from "@/lib/business-time";
import { formatMongolianDate, userFacingError } from "@/lib/ui-language";
import { requestJson } from "@/lib/client-request";
export function BookingCalendar({
  options,
  preview,
  mode,
}: {
  options: BookingOptions;
  preview: boolean;
  mode: "calendar" | "bookings";
}) {
  const [date, setDate] = useState(localStamp(new Date()).slice(0, 10)),
    [days, setDays] = useState(1),
    [branch, setBranch] = useState(""),
    [staff, setStaff] = useState(""),
    [rows, setRows] = useState<BookingView[]>([]),
    [loading, setLoading] = useState(!preview),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(0),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<BookingView | null>(null),
    [pending, setPending] = useState(false);
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
      ...(staff ? { staffId: staff } : {}),
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
  }, [date, days, branch, staff, refresh, preview]);
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
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ӨДӨР ТУТМЫН АЖИЛ</div>
          <h1>
            {mode === "calendar" ? "Календар" : "Захиалгууд"}
            <span className="heading-dot">.</span>
          </h1>
          <p>Бодит захиалгууд · Улаанбаатарын цагаар</p>
        </div>
        <Button disabled={preview} onClick={() => setCreating(true)}>
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
      <div className="feature-toolbar">
        <label className="field">
          Өдөр
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <label className="field">
          Харагдац
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>Өдөр</option>
            <option value={7}>Долоо хоног</option>
          </select>
        </label>
        <label className="field">
          Салбар
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setStaff("");
            }}
          >
            <option value="">Бүх салбар</option>
            {options.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Ажилтан
          <select value={staff} onChange={(e) => setStaff(e.target.value)}>
            <option value="">Бүх ажилтан</option>
            {options.staff
              .filter((s) => !branch || s.branchIds.includes(branch))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="calendar-controls">
        <Button
          variant="outline"
          aria-label="Өмнөх өдрүүд"
          onClick={() => setDate(addDays(date, -days))}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="outline"
          onClick={() => setDate(localStamp(new Date()).slice(0, 10))}
        >
          Өнөөдөр
        </Button>
        <Button
          variant="outline"
          aria-label="Дараах өдрүүд"
          onClick={() => setDate(addDays(date, days))}
        >
          <ChevronRight size={16} />
        </Button>
        <Button variant="ghost" onClick={() => setRefresh(refresh + 1)}>
          Шинэчлэх
        </Button>
      </div>
      {loading ? (
        <section className="panel empty-page" role="status">
          Захиалгуудыг ачаалж байна…
        </section>
      ) : (
        <div className={`booking-calendar ${days === 7 ? "week-view" : ""}`}>
          {Array.from({ length: days }, (_, i) => addDays(date, i)).map(
            (day) => (
              <section className="panel calendar-day" key={day}>
                <h2>{formatMongolianDate(new Date(`${day}T04:00:00Z`))}</h2>
                {rows.filter((b) => localStamp(b.startAt).slice(0, 10) === day)
                  .length ? (
                  rows
                    .filter((b) => localStamp(b.startAt).slice(0, 10) === day)
                    .map((b) => (
                      <button
                        className={`booking-card ${b.status === "CANCELLED" ? "cancelled" : ""}`}
                        key={b.id}
                        onClick={() => {
                          setError("");
                          setSelected(b);
                        }}
                      >
                        <strong>
                          {localStamp(b.startAt).slice(11)} —{" "}
                          {localStamp(b.endAt).slice(11)}
                        </strong>
                        <span>{b.customerName}</span>
                        <span>{b.serviceName}</span>
                        <small>
                          {b.staffName} · {b.branchName}
                        </small>
                        <span className="status-pill">
                          {statusLabels[b.status]}
                        </span>
                      </button>
                    ))
                ) : (
                  <p className="field-hint">Одоогоор захиалга алга.</p>
                )}
              </section>
            ),
          )}
        </div>
      )}
      <FeatureDialog
        open={creating}
        title="Шинэ захиалга"
        onClose={() => setCreating(false)}
      >
        <BookingWizard
          options={options}
          onSaved={(b) => {
            setDate(localStamp(b.startAt).slice(0, 10));
            setRefresh(refresh + 1);
          }}
        />
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
                {selected.priceMnt.toLocaleString("en-US")}₮
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
