"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "./ui/button";
import { Feedback } from "./ui/feature-dialog";
import type { BookingDraft, BookingOptions } from "./booking-wizard";
import { requestJson } from "@/lib/client-request";
import { formatMnt, userFacingError } from "@/lib/ui-language";
import { paymentLabels } from "@/lib/booking-validation";
import { addDays, localInstant, localStamp } from "@/lib/business-time";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return [h ? `${h}ц` : "", m ? `${m}м` : ""].filter(Boolean).join(" ");
}
type Saved = { startAt: string; branchId?: string };
type Payment = "POS" | "TRANSFER" | "CASH";
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
  // Up to two services that start together, each with its own staff.
  const [picked, setPicked] = useState<
      { serviceId: string; staffId: string }[]
    >([]),
    [date, setDate] = useState(
      initial.date && initial.date >= today ? initial.date : today,
    ),
    [preferred, setPreferred] = useState(initial.time ?? ""),
    [slots, setSlots] = useState<string[]>([]),
    [startAt, setStart] = useState(""),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [notes, setNotes] = useState(""),
    [extraOpen, setExtraOpen] = useState(false),
    [extra, setExtra] = useState(""),
    [payment, setPayment] = useState<Payment | "">("");
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const branchServices = options.services.filter((s) =>
      s.branchIds.includes(branchId),
    ),
    chosen = picked.flatMap((p) => {
      const service = branchServices.find((s) => s.id === p.serviceId);
      return service ? [{ ...p, service }] : [];
    }),
    eligible = (serviceId: string) =>
      options.staff.filter(
        (s) =>
          s.branchIds.includes(branchId) && s.serviceIds.includes(serviceId),
      ),
    length = Math.max(0, ...chosen.map((c) => c.service.durationMinutes)),
    extraMnt = extraOpen ? Math.max(0, Math.round(Number(extra) || 0)) : 0,
    total = chosen.reduce((sum, c) => sum + c.service.priceMnt, 0) + extraMnt,
    items = chosen.map((c) => ({
      serviceId: c.serviceId,
      ...(c.staffId ? { staffId: c.staffId } : {}),
    })),
    itemsKey = JSON.stringify(items);
  function toggle(serviceId: string) {
    setPreferred("");
    if (picked.some((p) => p.serviceId === serviceId))
      return setPicked(picked.filter((p) => p.serviceId !== serviceId));
    if (picked.length >= 2) return;
    // A slot clicked on the grid suggests that staff member for the first service.
    const suggested =
      !picked.length &&
      initial.staffId &&
      eligible(serviceId).some((s) => s.id === initial.staffId)
        ? initial.staffId
        : "";
    setPicked([...picked, { serviceId, staffId: suggested }]);
  }
  // Services grouped by category, uncategorised ones last.
  const categories = options.categories ?? [],
    rest = branchServices.filter(
      (s) => !categories.some((c) => c.id === s.categoryId),
    ),
    groups = [
      ...categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          services: branchServices.filter((s) => s.categoryId === c.id),
        }))
        .filter((g) => g.services.length),
      ...(rest.length ? [{ id: "other", name: "Бусад", services: rest }] : []),
    ];
  useEffect(() => {
    if (itemsKey === "[]" || !date) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setStart("");
      }
    });
    const q = new URLSearchParams({ branchId, date, items: itemsKey });
    fetch(`/api/visits?${q}`, { signal: controller.signal })
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
  }, [branchId, itemsKey, date, preferred]);
  // A returning customer's name fills in from their phone number.
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || name.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/customers?search=${encodeURIComponent(digits)}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          const found = (b?.customers ?? []).find((c: { phone: string }) =>
            c.phone.replace(/\D/g, "").endsWith(digits),
          );
          if (found && !controller.signal.aborted)
            setName((current) => current || found.name);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [phone, name]);
  const preferredMissed =
    !!preferred &&
    !loading &&
    chosen.length > 0 &&
    !startAt &&
    slots.length > 0;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !chosen.length || !startAt) return;
    setPending(true);
    setError("");
    const input = {
      branchId,
      items,
      startAt,
      customer: { name, phone },
      extraMnt,
      ...(payment ? { paymentMethod: payment } : {}),
      notes,
    };
    const payload = JSON.stringify(input);
    if (submission.current?.payload !== payload)
      submission.current = { payload, key: crypto.randomUUID() };
    try {
      const saved = await requestJson<Saved>("/api/visits", "POST", {
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
        <div className="quick-section">
          <h3>Үйлчлүүлэгч</h3>
          <div className="form-grid">
            <label className="field">
              Нэр
              <input
                required
                value={name}
                maxLength={100}
                autoComplete="off"
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
                autoComplete="off"
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
        </div>
        <fieldset className="service-groups">
          <legend className="quick-legend">Үйлчилгээ</legend>
          {groups.map((g) => (
            <section className="service-group" key={g.id}>
              <h3>{g.name}</h3>
              <div className="service-options">
                {g.services.map((s) => {
                  const on = picked.some((p) => p.serviceId === s.id);
                  return (
                    <label
                      key={s.id}
                      className="service-option"
                      data-checked={on || undefined}
                    >
                      <input
                        type="checkbox"
                        name="service"
                        value={s.id}
                        checked={on}
                        disabled={!on && picked.length >= 2}
                        onChange={() => toggle(s.id)}
                      />
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {formatDuration(s.durationMinutes)} ·{" "}
                          {formatMnt(s.priceMnt)}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
          {!groups.length && (
            <p className="field-hint">Энэ салбарт захиалах үйлчилгээ алга.</p>
          )}
          <p className="field-hint">
            2 хүртэл үйлчилгээ сонгож болно. Хоёр үйлчилгээг 2 ажилтан зэрэг
            эхлүүлнэ.
          </p>
        </fieldset>
        <div className="form-grid">
          {chosen.map((c, i) => (
            <label className="field" key={c.serviceId}>
              {chosen.length > 1 ? `${c.service.name} · ажилтан` : "Ажилтан"}
              <select
                value={c.staffId}
                onChange={(e) => {
                  setPreferred("");
                  setPicked(
                    picked.map((p, j) =>
                      j === i ? { ...p, staffId: e.target.value } : p,
                    ),
                  );
                }}
              >
                <option value="">Аль ч ажилтан</option>
                {eligible(c.serviceId)
                  .filter(
                    (s) =>
                      !chosen.some((o, j) => j !== i && o.staffId === s.id),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
          ))}
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
          <div className="quick-section-head">
            <h3>Эхлэх цаг</h3>
            {chosen.length > 0 && (
              <small>
                {chosen.length > 1
                  ? `Хоёр үйлчилгээ зэрэг эхэлнэ · ${formatDuration(length)}`
                  : formatDuration(length)}
              </small>
            )}
          </div>
          {!chosen.length ? (
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
        <div className="quick-section quick-payment">
          <h3>Төлбөр</h3>
          {chosen.length ? (
            chosen.map((c) => (
              <div className="pay-row" key={c.serviceId}>
                <span>{c.service.name}</span>
                <span>{formatMnt(c.service.priceMnt)}</span>
              </div>
            ))
          ) : (
            <div className="pay-row">
              <span>Үйлчилгээ</span>
              <span>—</span>
            </div>
          )}
          {extraOpen ? (
            <div className="pay-row pay-extra">
              <label htmlFor="extra-amount">Нэмэлт төлбөр</label>
              <span>
                <input
                  id="extra-amount"
                  type="number"
                  min={0}
                  max={100000000}
                  step={1000}
                  inputMode="numeric"
                  placeholder="0"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                />
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
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="add-extra"
              onClick={() => setExtraOpen(true)}
            >
              <Plus size={14} /> Нэмэлт төлбөр
            </button>
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
                aria-pressed={payment === m}
                onClick={() => setPayment(payment === m ? "" : m)}
              >
                {paymentLabels[m]}
              </button>
            ))}
          </div>
        </div>
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
      <div className="quick-footer">
        <p>
          {chosen.length ? (
            <>
              <strong>{formatMnt(total)}</strong>
              {startAt && ` · ${localStamp(startAt).slice(11)}`} ·{" "}
              {chosen.map((c) => c.service.name).join(" + ")}
            </>
          ) : (
            "Үйлчилгээ сонгоно уу"
          )}
        </p>
        <Button type="button" variant="outline" onClick={onClose}>
          Болих
        </Button>
        <Button disabled={pending || !chosen.length || !startAt || loading}>
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
