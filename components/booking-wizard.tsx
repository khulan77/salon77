"use client";
import {
  DepositInstructions,
  type DepositDetails,
} from "./deposit-instructions";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Feedback } from "./ui/feature-dialog";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
import { localStamp, addDays } from "@/lib/business-time";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import {
  defaultBookingSettings,
  type BookingPolicy,
} from "@/lib/booking-settings";
export type BookingOptions = {
  branches: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
  services: {
    id: string;
    categoryId?: string;
    name: string;
    priceMnt: number;
    durationMinutes: number;
    branchIds: string[];
  }[];
  staff: {
    id: string;
    name: string;
    branchIds: string[];
    serviceIds: string[];
  }[];
};
// Prefill from the calendar grid: a clicked staff column and time slot.
export type BookingDraft = {
  branchId?: string;
  staffId?: string;
  date?: string;
  time?: string;
};
export function BookingWizard({
  options,
  slug,
  onSaved,
  initial,
  policy = defaultBookingSettings,
}: {
  options: BookingOptions;
  policy?: BookingPolicy;
  slug?: string;
  initial?: BookingDraft;
  onSaved?: (booking: { startAt: string; branchId?: string }) => void;
}) {
  const today = localStamp(new Date()).slice(0, 10);
  const [step, setStep] = useState(1),
    [branchId, setBranch] = useState(
      initial?.branchId || options.branches[0]?.id || "",
    ),
    [serviceId, setService] = useState(""),
    [staffId, setStaff] = useState(initial?.staffId ?? ""),
    [date, setDate] = useState(
      initial?.date && initial.date >= today ? initial.date : today,
    ),
    [preferredTime, setPreferredTime] = useState(initial?.time ?? ""),
    [startAt, setStart] = useState("");
  const [slots, setSlots] = useState<{ startAt: string }[]>([]),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [notes, setNotes] = useState(""),
    [search, setSearch] = useState(""),
    [customerId, setCustomer] = useState(""),
    [customers, setCustomers] = useState<
      { id: string; name: string; phone: string }[]
    >([]);
  const [receipt, setReceipt] = useState<{
    serviceName: string;
    status?: string;
    staffName?: string;
    branchName?: string;
    startAt: string;
    priceMnt: number;
    deposit?: DepositDetails | null;
  } | null>(null);
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const service = options.services.find((s) => s.id === serviceId),
    staff = options.staff.filter(
      (s) => s.branchIds.includes(branchId) && s.serviceIds.includes(serviceId),
    );
  useEffect(() => {
    if (!branchId || !serviceId || !date || step !== 2) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setError("");
        setStart("");
      }
    });
    const q = new URLSearchParams({
      branchId,
      serviceId,
      date,
      ...(staffId ? { staffId } : {}),
    });
    fetch(
      slug
        ? `/api/public/${encodeURIComponent(slug)}/availability?${q}`
        : `/api/availability?${q}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setSlots(body.slots);
        const preferred = body.slots.find(
          (s: { startAt: string }) =>
            localStamp(s.startAt).slice(11) === preferredTime,
        );
        if (preferred) setStart(preferred.startAt);
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
  }, [branchId, serviceId, staffId, date, slug, step, refresh, preferredTime]);
  useEffect(() => {
    if (slug || search.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/customers?search=${encodeURIComponent(search)}`, {
        signal: controller.signal,
      })
        .then(async (r) => {
          const b = await r.json();
          if (!r.ok) throw new Error(b.error);
          setCustomers(b.customers);
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
  }, [search, slug]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    if (pending) return;
    setPending(true);
    setError("");
    const input = {
      branchId,
      serviceId,
      ...(staffId ? { staffId } : {}),
      startAt,
      ...(customerId && !slug
        ? { customerId }
        : { customer: { name, phone, email } }),
      notes: slug ? "" : notes,
    };
    const payload = JSON.stringify(input);
    if (submission.current?.payload !== payload)
      submission.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await requestJson<{
        branchId?: string;
        serviceName: string;
        staffName?: string;
        branchName?: string;
        startAt: string;
        priceMnt: number;
        deposit?: DepositDetails | null;
      }>(
        slug
          ? `/api/public/${encodeURIComponent(slug)}/bookings`
          : "/api/bookings",
        "POST",
        { ...input, idempotencyKey: submission.current!.key },
      );
      setReceipt(result);
      onSaved?.(result);
    } catch (e) {
      setError(
        userFacingError(e, "Захиалга хадгалж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setPending(false);
    }
  }
  if (receipt)
    return (
      <section className="booking-success" role="status">
        <h2>Захиалга амжилттай</h2>
        <p>{receipt.serviceName}</p>
        <p>
          {receipt.branchName ??
            options.branches.find((b) => b.id === branchId)?.name}{" "}
          ·{" "}
          {receipt.staffName ||
            options.staff.find((s) => s.id === staffId)?.name}
        </p>
        <strong>{localStamp(receipt.startAt).replace("T", " ")}</strong>
        <p>{receipt.priceMnt.toLocaleString("en-US")}₮</p>
        {slug && (
          <p>
            {receipt.status === "CONFIRMED"
              ? "Таны захиалга баталгаажлаа."
              : "Захиалгыг салон хүлээн авлаа. Баталгаажуулахыг хүлээнэ үү."}
          </p>
        )}
        {receipt.deposit && <DepositInstructions deposit={receipt.deposit} />}
      </section>
    );
  return (
    <form
      onSubmit={submit}
      onInvalidCapture={localizeInvalidField}
      onInputCapture={clearFieldValidity}
    >
      <div className="booking-steps" aria-label="Захиалгын алхмууд">
        {["Үйлчилгээ", "Цаг", "Үйлчлүүлэгч", "Баталгаажуулах"].map(
          (text, i) => (
            <span key={text} aria-current={step === i + 1 ? "step" : undefined}>
              {i + 1}. {text}
            </span>
          ),
        )}
      </div>
      <Feedback error={error} />
      {step === 1 && (
        <>
          <label className="field">
            Салбар
            <select
              value={branchId}
              required
              onChange={(e) => {
                setBranch(e.target.value);
                setService("");
                setStaff("");
                setStart("");
              }}
            >
              <option value="">Салбар сонгох</option>
              {options.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Үйлчилгээ
            <select
              value={serviceId}
              required
              onChange={(e) => {
                const next = e.target.value;
                setService(next);
                if (
                  !options.staff.some(
                    (s) => s.id === staffId && s.serviceIds.includes(next),
                  )
                )
                  setStaff("");
                setStart("");
              }}
            >
              <option value="">Үйлчилгээ сонгох</option>
              {options.services
                .filter((s) => s.branchIds.includes(branchId))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.durationMinutes} мин ·{" "}
                    {s.priceMnt.toLocaleString("en-US")}₮
                  </option>
                ))}
            </select>
          </label>
          {!options.services.length && (
            <p className="notice">Одоогоор захиалах үйлчилгээ алга.</p>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <label className="field">
            Ажилтан
            <select
              value={staffId}
              onChange={(e) => {
                setStaff(e.target.value);
                setPreferredTime("");
              }}
            >
              <option value="">Аль ч ажилтан</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Өдөр
            <input
              type="date"
              required
              min={localStamp(new Date()).slice(0, 10)}
              max={addDays(
                localStamp(new Date()).slice(0, 10),
                slug ? policy.advanceBookingDays : 365,
              )}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPreferredTime("");
              }}
            />
          </label>
          <p className="field-hint">
            Улаанбаатарын цагаар · {service?.durationMinutes} минут
          </p>
          {loading ? (
            <p role="status">Боломжтой цагийг хайж байна…</p>
          ) : slots.length ? (
            <div className="slot-grid">
              {slots.map((s) => (
                <Button
                  type="button"
                  variant={startAt === s.startAt ? "default" : "outline"}
                  key={s.startAt}
                  aria-pressed={startAt === s.startAt}
                  onClick={() => setStart(s.startAt)}
                >
                  {localStamp(s.startAt).slice(11)}
                </Button>
              ))}
            </div>
          ) : (
            <p className="notice">
              Энэ өдөр боломжтой цаг алга. Өөр өдөр эсвэл ажилтан сонгоно уу.
            </p>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRefresh(refresh + 1)}
          >
            Цагийг шинэчлэх
          </Button>
        </>
      )}
      {step === 3 && (
        <>
          {!slug && (
            <>
              <label className="field">
                Үйлчлүүлэгч хайх
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Нэр эсвэл утасны дугаар"
                  maxLength={100}
                />
              </label>
              <div className="customer-search-results">
                {(search.length >= 2 ? customers : []).map((c) => (
                  <Button
                    type="button"
                    variant="outline"
                    key={c.id}
                    onClick={() => {
                      setCustomer(c.id);
                      setName(c.name);
                      setPhone(c.phone);
                      setSearch("");
                    }}
                  >
                    {c.name} · {c.phone}
                  </Button>
                ))}
              </div>
            </>
          )}
          {customerId ? (
            <div className="notice">
              {name} · {phone}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCustomer("");
                  setName("");
                  setPhone("");
                }}
              >
                Шинээр бүртгэх
              </Button>
            </div>
          ) : (
            <>
              <label className="field">
                Нэр
                <input
                  required
                  value={name}
                  maxLength={100}
                  autoComplete="name"
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
                  autoComplete="tel"
                  placeholder="99112233"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="field">
                Имэйл · заавал биш
                <input
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </>
          )}
          {!slug && (
            <label className="field">
              Тэмдэглэл
              <textarea
                value={notes}
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          )}
        </>
      )}
      {step === 4 && (
        <div className="booking-summary">
          <h3>{service?.name}</h3>
          <p>{options.branches.find((b) => b.id === branchId)?.name}</p>
          <p>
            {staffId
              ? staff.find((s) => s.id === staffId)?.name
              : "Аль ч ажилтан"}
          </p>
          <strong>{startAt && localStamp(startAt).replace("T", " ")}</strong>
          <p>
            {service?.durationMinutes} минут ·{" "}
            {service?.priceMnt.toLocaleString("en-US")}₮
          </p>
          <p>
            {name} · {phone}
          </p>
          {slug && (
            <p>
              {policy.depositRequired
                ? "Захиалсны дараа урьдчилгаа шилжүүлэх дансны мэдээлэл гарна."
                : policy.bookingConfirmationMode === "AUTO_CONFIRM"
                  ? "Захиалга шууд баталгаажна."
                  : "Салон захиалгыг гараар баталгаажуулна."}
            </p>
          )}
        </div>
      )}
      <div className="form-actions">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setStep(step - 1)}
          >
            Буцах
          </Button>
        )}
        <Button
          disabled={
            pending ||
            (step === 1 && !serviceId) ||
            (step === 2 && (!startAt || loading))
          }
        >
          {pending
            ? "Хадгалж байна…"
            : step === 4
              ? "Баталгаажуулах"
              : "Үргэлжлүүлэх"}
        </Button>
      </div>
    </form>
  );
}
