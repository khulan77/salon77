"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "./ui/button";
import { Feedback } from "./ui/feature-dialog";
import type { BookingDraft, BookingOptions } from "./booking-wizard";
import { requestJson } from "@/lib/client-request";
import { formatMnt, userFacingError } from "@/lib/ui-language";
import { addDays, localInstant, localStamp } from "@/lib/business-time";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
// Fixed choices staff use most; "auto" keeps the service's own length.
const durations = [30, 60, 90, 120, 150, 180, 240];
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return [h ? `${h}ц` : "", m ? `${m}м` : ""].filter(Boolean).join(" ");
}
type Saved = { startAt: string; branchId?: string };
// Single-screen admin booking: service, staff, time and customer in one pass.
export function QuickBooking({
  options,
  initial,
  onSaved,
  onTimeOffSaved,
  onClose,
}: {
  options: BookingOptions;
  initial: BookingDraft;
  onSaved: (booking: Saved) => void;
  onTimeOffSaved: (date: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"booking" | "timeOff">("booking");
  return (
    <div className="quick-booking">
      <div className="quick-tabs" role="tablist" aria-label="Бүртгэлийн төрөл">
        {(
          [
            ["booking", "Цаг захиалга"],
            ["timeOff", "Чөлөө"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "booking" ? (
        <BookingForm
          options={options}
          initial={initial}
          onSaved={onSaved}
          onClose={onClose}
        />
      ) : (
        <TimeOffForm
          options={options}
          initial={initial}
          onSaved={onTimeOffSaved}
          onClose={onClose}
        />
      )}
    </div>
  );
}
function BookingForm({
  options,
  initial,
  onSaved,
  onClose,
}: {
  options: BookingOptions;
  initial: BookingDraft;
  onSaved: (booking: Saved) => void;
  onClose: () => void;
}) {
  const today = localStamp(new Date()).slice(0, 10),
    branchId = initial.branchId || options.branches[0]?.id || "";
  const [query, setQuery] = useState(""),
    [serviceId, setService] = useState(""),
    [staffId, setStaff] = useState(initial.staffId ?? ""),
    [date, setDate] = useState(
      initial.date && initial.date >= today ? initial.date : today,
    ),
    [duration, setDuration] = useState(0),
    [preferred, setPreferred] = useState(initial.time ?? ""),
    [slots, setSlots] = useState<string[]>([]),
    [startAt, setStart] = useState(""),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [matches, setMatches] = useState<
      { id: string; name: string; phone: string }[]
    >([]),
    [customerId, setCustomer] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [notes, setNotes] = useState("");
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const branchServices = options.services.filter((s) =>
      s.branchIds.includes(branchId),
    ),
    service = branchServices.find((s) => s.id === serviceId),
    eligible = options.staff.filter(
      (s) =>
        s.branchIds.includes(branchId) &&
        (!serviceId || s.serviceIds.includes(serviceId)),
    ),
    length = duration || service?.durationMinutes || 0,
    staffName = options.staff.find((s) => s.id === staffId)?.name;
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase(),
      visible = branchServices.filter(
        (s) => !needle || s.name.toLowerCase().includes(needle),
      ),
      categories = options.categories ?? [];
    const known = categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        services: visible.filter((s) => s.categoryId === c.id),
      }))
      .filter((g) => g.services.length);
    const rest = visible.filter(
      (s) => !categories.some((c) => c.id === s.categoryId),
    );
    return rest.length
      ? [...known, { id: "other", name: "Бусад", services: rest }]
      : known;
  }, [branchServices, options.categories, query]);
  useEffect(() => {
    if (!serviceId || !date) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setStart("");
      }
    });
    const q = new URLSearchParams({
      branchId,
      serviceId,
      date,
      ...(staffId ? { staffId } : {}),
      ...(duration ? { durationMinutes: String(duration) } : {}),
    });
    fetch(`/api/availability?${q}`, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        const list = (body.slots as { startAt: string }[]).map(
          (s) => s.startAt,
        );
        setSlots(list);
        setError("");
        const match = list.find((s) => localStamp(s).slice(11) === preferred);
        if (match) setStart(match);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setSlots([]);
          setError(userFacingError(e, "Боломжтой цагийг ачаалж чадсангүй."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [branchId, serviceId, staffId, date, duration, preferred]);
  useEffect(() => {
    if (search.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/customers?search=${encodeURIComponent(search.trim())}`, {
        signal: controller.signal,
      })
        .then(async (r) => {
          const b = await r.json();
          if (!r.ok) throw new Error(b.error);
          setMatches(b.customers);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(userFacingError(e, "Хайлт амжилтгүй боллоо."));
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  const preferredMissed =
    !!preferred && !loading && !!serviceId && !startAt && slots.length > 0;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !service || !startAt) return;
    setPending(true);
    setError("");
    const input = {
      branchId,
      serviceId,
      ...(staffId ? { staffId } : {}),
      startAt,
      ...(duration && duration !== service.durationMinutes
        ? { durationMinutes: duration }
        : {}),
      ...(customerId ? { customerId } : { customer: { name, phone } }),
      notes,
    };
    const payload = JSON.stringify(input);
    if (submission.current?.payload !== payload)
      submission.current = { payload, key: crypto.randomUUID() };
    try {
      const saved = await requestJson<Saved>("/api/bookings", "POST", {
        ...input,
        idempotencyKey: submission.current.key,
      });
      onSaved(saved);
    } catch (e) {
      setError(
        userFacingError(e, "Захиалга хадгалж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="quick-form"
      onSubmit={submit}
      onInvalidCapture={localizeInvalidField}
      onInputCapture={clearFieldValidity}
    >
      <div className="quick-body">
        <Feedback error={error} />
        <label className="quick-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            aria-label="Үйлчилгээ хайх"
            placeholder="Үйлчилгээ хайх…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <fieldset className="service-groups">
          <legend className="sr-only">Үйлчилгээ</legend>
          {groups.map((g) => (
            <section className="service-group" key={g.id}>
              <h3>{g.name}</h3>
              <div className="service-options">
                {g.services.map((s) => (
                  <label
                    key={s.id}
                    className="service-option"
                    data-checked={serviceId === s.id || undefined}
                  >
                    <input
                      type="radio"
                      name="service"
                      value={s.id}
                      checked={serviceId === s.id}
                      onChange={() => {
                        setService(s.id);
                        setDuration(0);
                        if (
                          staffId &&
                          !options.staff.some(
                            (p) =>
                              p.id === staffId && p.serviceIds.includes(s.id),
                          )
                        )
                          setStaff("");
                      }}
                    />
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {formatDuration(s.durationMinutes)} ·{" "}
                        {formatMnt(s.priceMnt)}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
          {!groups.length && (
            <p className="field-hint">
              {query
                ? "Хайлтад тохирох үйлчилгээ алга."
                : "Энэ салбарт захиалах үйлчилгээ алга."}
            </p>
          )}
        </fieldset>
        <div className="form-grid">
          <label className="field">
            Үндсэн ажилтан
            <select
              value={staffId}
              onChange={(e) => {
                setStaff(e.target.value);
                setPreferred("");
              }}
            >
              <option value="">Аль ч ажилтан</option>
              {eligible.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Огноо
            <input
              type="date"
              required
              min={today}
              max={addDays(today, 365)}
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
                setPreferred("");
              }}
            />
          </label>
        </div>
        <div className="quick-section">
          <h3 id="duration-label">Үргэлжлэх хугацаа</h3>
          <div
            className="chip-row"
            role="group"
            aria-labelledby="duration-label"
          >
            {[0, ...durations].map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={duration === m}
                onClick={() => setDuration(m)}
              >
                {m ? formatDuration(m) : "Автомат"}
              </button>
            ))}
          </div>
        </div>
        <div className="quick-section">
          <div className="quick-section-head">
            <h3>Эхлэх цаг</h3>
            {service && (
              <small>
                {staffName ?? "Аль ч ажилтан"} · {formatDuration(length)}
              </small>
            )}
          </div>
          {!service ? (
            <p className="field-hint">Эхлээд үйлчилгээ сонгоно уу.</p>
          ) : loading ? (
            <p className="field-hint" role="status">
              Боломжтой цагийг хайж байна…
            </p>
          ) : slots.length ? (
            <div className="slot-grid quick-slots">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s}
                  className="chip slot"
                  aria-pressed={startAt === s}
                  onClick={() => setStart(s)}
                >
                  {localStamp(s).slice(11)}
                </button>
              ))}
            </div>
          ) : (
            <p className="notice">
              Энэ өдөр сул цаг алга. Өөр өдөр эсвэл ажилтан сонгоно уу.
            </p>
          )}
          {preferredMissed && (
            <p className="field-hint">
              Сонгосон {preferred} цаг завгүй байна — сул цагаас сонгоно уу.
            </p>
          )}
        </div>
        <div className="quick-section">
          <h3>Үйлчлүүлэгч</h3>
          {customerId ? (
            <div className="selected-customer">
              <span>
                <strong>{name}</strong> · {phone}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCustomer("");
                  setName("");
                  setPhone("");
                }}
              >
                Өөрчлөх
              </Button>
            </div>
          ) : (
            <>
              <label className="field">
                Үйлчлүүлэгч хайх
                <input
                  value={search}
                  maxLength={100}
                  placeholder="Нэр эсвэл утасны дугаар"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              {search.trim().length >= 2 && matches.length > 0 && (
                <div className="customer-search-results">
                  {matches.map((c) => (
                    <Button
                      type="button"
                      variant="outline"
                      key={c.id}
                      onClick={() => {
                        setCustomer(c.id);
                        setName(c.name);
                        setPhone(c.phone);
                        setSearch("");
                        setMatches([]);
                      }}
                    >
                      {c.name} · {c.phone}
                    </Button>
                  ))}
                </div>
              )}
              <div className="form-grid">
                <label className="field">
                  Нэр
                  <input
                    required
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="field">
                  Утас
                  <input
                    required
                    type="tel"
                    value={phone}
                    maxLength={40}
                    placeholder="99112233"
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              </div>
            </>
          )}
          <label className="field">
            Тэмдэглэл
            <textarea
              rows={2}
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="quick-footer">
        <p>
          {service ? (
            <>
              <strong>{service.name}</strong>
              {startAt && ` · ${localStamp(startAt).slice(11)}`} ·{" "}
              {formatMnt(service.priceMnt)}
            </>
          ) : (
            "Үйлчилгээ сонгоно уу"
          )}
        </p>
        <Button type="button" variant="outline" onClick={onClose}>
          Болих
        </Button>
        <Button disabled={pending || !service || !startAt || loading}>
          {pending ? "Хадгалж байна…" : "Захиалах"}
        </Button>
      </div>
    </form>
  );
}
export function TimeOffForm({
  options,
  initial,
  onSaved,
  onClose,
}: {
  options: BookingOptions;
  initial: BookingDraft;
  onSaved: (date: string) => void;
  onClose: () => void;
}) {
  const branchId = initial.branchId || options.branches[0]?.id || "",
    staff = options.staff.filter((s) => s.branchIds.includes(branchId));
  const [staffId, setStaff] = useState(initial.staffId || staff[0]?.id || ""),
    [date, setDate] = useState(
      initial.date ?? localStamp(new Date()).slice(0, 10),
    ),
    [fullDay, setFullDay] = useState(false),
    [from, setFrom] = useState(initial.time ?? "13:00"),
    [to, setTo] = useState(() => {
      const [h, m] = (initial.time ?? "13:00").split(":").map(Number);
      return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const startsAt = localInstant(`${date}T${fullDay ? "00:00" : from}`),
        endsAt = fullDay
          ? localInstant(`${addDays(date, 1)}T00:00`)
          : localInstant(`${date}T${to}`);
      await requestJson("/api/time-off", "POST", {
        staffId,
        branchId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        fullDay,
        reason,
      });
      onSaved(date);
    } catch (e) {
      setError(userFacingError(e, "Чөлөөг хадгалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="quick-form"
      onSubmit={submit}
      onInvalidCapture={localizeInvalidField}
      onInputCapture={clearFieldValidity}
    >
      <div className="quick-body">
        <Feedback error={error} />
        <p className="field-hint">
          Чөлөөтэй хугацаанд тухайн ажилтанд захиалга авахгүй.
        </p>
        <div className="form-grid">
          <label className="field">
            Ажилтан
            <select
              required
              value={staffId}
              onChange={(e) => setStaff(e.target.value)}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Огноо
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={fullDay}
            onChange={(e) => setFullDay(e.target.checked)}
          />
          Бүтэн өдөр
        </label>
        {!fullDay && (
          <div className="form-grid">
            <label className="field">
              Эхлэх
              <input
                type="time"
                required
                step={900}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="field">
              Дуусах
              <input
                type="time"
                required
                step={900}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        )}
        <label className="field">
          Шалтгаан · заавал биш
          <input
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>
      <div className="quick-footer">
        <p>
          {staff.find((s) => s.id === staffId)?.name}
          {fullDay ? " · Бүтэн өдөр" : ` · ${from} — ${to}`}
        </p>
        <Button type="button" variant="outline" onClick={onClose}>
          Болих
        </Button>
        <Button disabled={pending || !staffId}>
          {pending ? "Хадгалж байна…" : "Чөлөө бүртгэх"}
        </Button>
      </div>
    </form>
  );
}
