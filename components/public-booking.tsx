"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import type { PublicCatalog } from "@/lib/services/bookings";
import type { VisitReceipt } from "@/lib/services/visits";
import { addDays, localStamp } from "@/lib/business-time";
import { clockTime } from "@/lib/schedule-time";
import { tone, initials } from "@/lib/avatar";
import { formatDuration, formatMnt, userFacingError } from "@/lib/ui-language";
import { depositAmount } from "@/lib/booking-settings";
import { DepositInstructions } from "./deposit-instructions";
type Service = PublicCatalog["services"][number];
type Step = "menu" | "time" | "details" | "done";
const MAX_SERVICES = 2;
const weekdays = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
function dayLabel(date: string) {
  return weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()];
}
function period(time: string) {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? "Өглөө" : hour < 17 ? "Өдөр" : "Орой";
}
function instagramUrl(handle: string) {
  return handle.startsWith("http")
    ? handle
    : `https://instagram.com/${handle.replace(/^@/, "")}`;
}
export function PublicBooking({
  slug,
  catalog,
}: {
  slug: string;
  catalog: PublicCatalog;
}) {
  const { salon, policy } = catalog;
  const [step, setStep] = useState<Step>("menu");
  const [branchId, setBranchId] = useState(catalog.branches[0]?.id ?? "");
  const [category, setCategory] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const today = localStamp(new Date()).slice(0, 10);
  const [date, setDate] = useState(today);
  // Availability is keyed by the exact request so stale answers never show.
  const [found, setFound] = useState<{
    key: string;
    slots: string[];
    error?: string;
  } | null>(null);
  const [startAt, setStartAt] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<
    (VisitReceipt & { manageUrl?: string | null }) | null
  >(null);
  // Keep one idempotency key per payload so retries never double-book.
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const trap = useRef<HTMLInputElement>(null);
  const branch = catalog.branches.find((b) => b.id === branchId);
  const offered = catalog.services.filter((s) =>
    s.branchIds.includes(branchId),
  );
  const chosen = picked
    .map((id) => catalog.services.find((s) => s.id === id))
    .filter((s): s is Service => Boolean(s));
  const total = chosen.reduce((sum, s) => sum + s.priceMnt, 0);
  const longest = Math.max(0, ...chosen.map((s) => s.durationMinutes));
  const eligible = (serviceId: string) =>
    catalog.staff.filter(
      (s) => s.branchIds.includes(branchId) && s.serviceIds.includes(serviceId),
    );
  const sameStaff =
    chosen.length === 2 &&
    staff[chosen[0].id] &&
    staff[chosen[0].id] === staff[chosen[1].id];
  const days = useMemo(
    () =>
      Array.from(
        { length: Math.min(policy.advanceBookingDays, 30) + 1 },
        (_, i) => addDays(today, i),
      ),
    [policy.advanceBookingDays, today],
  );
  const deposit = chosen.reduce(
    (sum, s) => sum + depositAmount(s.priceMnt, policy),
    0,
  );
  const request =
    step === "time" && chosen.length && !sameStaff
      ? new URLSearchParams({
          branchId,
          date,
          services: chosen.map((s) => s.id).join(","),
          staff: chosen.map((s) => staff[s.id] ?? "").join(","),
        }).toString()
      : null;
  const loading = request !== null && found?.key !== request;
  const slots = found && found.key === request ? found.slots : [];
  const slotError = found && found.key === request ? found.error : undefined;
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    fetch(`/api/public/${encodeURIComponent(slug)}/visits?${request}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setFound({
          key: request,
          slots: data.slots.map((s: { startAt: string }) => s.startAt),
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setFound({
            key: request,
            slots: [],
            error: userFacingError(e, "Сул цагийг ачаалж чадсангүй."),
          });
      });
    return () => controller.abort();
  }, [request, slug]);
  function toggle(id: string) {
    setStartAt("");
    setPicked((p) =>
      p.includes(id)
        ? p.filter((x) => x !== id)
        : p.length < MAX_SERVICES
          ? [...p, id]
          : p,
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    const body = {
      branchId,
      startAt,
      items: chosen.map((s) => ({
        serviceId: s.id,
        ...(staff[s.id] ? { staffId: staff[s.id] } : {}),
      })),
      customer: { name: name.trim(), phone: phone.trim() },
      website: trap.current?.value || undefined,
    };
    const payload = JSON.stringify(body);
    if (submission.current?.payload !== payload)
      submission.current = { payload, key: crypto.randomUUID() };
    try {
      const response = await fetch(
        `/api/public/${encodeURIComponent(slug)}/visits`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            idempotencyKey: submission.current.key,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setStartAt("");
        setStep("time");
        throw new Error(data.error);
      }
      if (!response.ok) throw new Error(data.error);
      setReceipt(data);
      setStep("done");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(
        userFacingError(e, "Захиалга хадгалж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setSending(false);
    }
  }
  const hero = (
    <header className="pb-hero">
      <div className="pb-cover">
        {salon.coverUrl ? (
          <Image
            src={salon.coverUrl}
            alt={`${salon.name} салоны зураг`}
            fill
            unoptimized
            priority
            sizes="(max-width: 700px) 100vw, 720px"
          />
        ) : (
          <span aria-hidden="true">{initials(salon.name)}</span>
        )}
      </div>
      <div className="pb-hero-body">
        <h1>{salon.name}</h1>
        {salon.description && <p className="pb-about">{salon.description}</p>}
        {branch && (
          <ul className="pb-facts">
            <li>
              <MapPin size={14} />
              {[branch.district, branch.address].filter(Boolean).join(", ")}
            </li>
            <li>
              <Clock3 size={14} />
              Өдөр бүр {clockTime(branch.openMinute)} –{" "}
              {clockTime(branch.closeMinute)}
            </li>
          </ul>
        )}
        <div className="pb-contact">
          {(branch?.phone || salon.phone) && (
            <a href={`tel:${branch?.phone || salon.phone}`}>
              <Phone size={14} /> Залгах
            </a>
          )}
          {salon.instagram && (
            <a
              href={instagramUrl(salon.instagram)}
              target="_blank"
              rel="noreferrer"
            >
              Инстаграм
            </a>
          )}
        </div>
      </div>
    </header>
  );
  if (!policy.publicBookingEnabled)
    return (
      <div className="pb">
        {hero}
        <p className="pb-closed" role="status">
          Онлайн захиалга одоогоор хаалттай байна. Салон руу залгаж цаг товлоно
          уу.
        </p>
      </div>
    );
  if (step === "done" && receipt)
    return (
      <div className="pb">
        <section className="pb-done" role="status">
          <span className="pb-done-icon">
            <Check size={26} />
          </span>
          <h1>Захиалга амжилттай</h1>
          <p>
            {receipt.status === "CONFIRMED"
              ? "Таны цаг баталгаажлаа."
              : "Салон таны захиалгыг хүлээн авлаа. Баталгаажуулахыг хүлээнэ үү."}
          </p>
          <div className="pb-ticket">
            <strong>{receipt.salonName}</strong>
            <span>
              <CalendarDays size={14} />
              {localStamp(receipt.startAt).replace("T", " ")}
            </span>
            <span>
              <MapPin size={14} />
              {receipt.branchName}
            </span>
            {receipt.items.map((i) => (
              <div className="pb-ticket-row" key={i.serviceName}>
                <div>
                  <b>{i.serviceName}</b>
                  <small>
                    {i.staffName} · {localStamp(i.endAt).slice(11)} хүртэл
                  </small>
                </div>
                <b>{formatMnt(i.priceMnt)}</b>
              </div>
            ))}
            <div className="pb-ticket-total">
              <span>Нийт</span>
              <b>{formatMnt(receipt.totalMnt)}</b>
            </div>
          </div>
          {receipt.deposit && <DepositInstructions deposit={receipt.deposit} />}
          {receipt.manageUrl && (
            <a className="pb-manage-link" href={receipt.manageUrl}>
              Захиалгаа удирдах
              <small>
                Энэ холбоосоор цуцлах, цагаа өөрчлөх боломжтой. Хадгалж аваарай.
              </small>
            </a>
          )}
          <button
            type="button"
            className="pb-secondary"
            onClick={() => {
              setReceipt(null);
              setPicked([]);
              setStaff({});
              setStartAt("");
              submission.current = null;
              setStep("menu");
            }}
          >
            Дахин захиалах
          </button>
        </section>
      </div>
    );
  const grouped = ["Өглөө", "Өдөр", "Орой"]
    .map((label) => ({
      label,
      times: slots.filter((s) => period(localStamp(s).slice(11)) === label),
    }))
    .filter((g) => g.times.length);
  return (
    <div className="pb">
      {step === "menu" ? (
        hero
      ) : (
        <div className="pb-topbar">
          <button
            type="button"
            className="pb-back"
            aria-label="Буцах"
            onClick={() => setStep(step === "details" ? "time" : "menu")}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <strong>{salon.name}</strong>
            <span>
              {step === "time" ? "Ажилтан, цаг сонгох" : "Таны мэдээлэл"}
            </span>
          </div>
        </div>
      )}
      <ol className="pb-progress" aria-label="Захиалгын алхмууд">
        {(["menu", "time", "details"] as const).map((s, i) => (
          <li
            key={s}
            aria-current={step === s ? "step" : undefined}
            className={
              ["menu", "time", "details"].indexOf(step) >= i ? "on" : ""
            }
          >
            {["Үйлчилгээ", "Цаг", "Мэдээлэл"][i]}
          </li>
        ))}
      </ol>
      {(error || slotError) && (
        <p className="pb-error" role="alert">
          {error || slotError}
        </p>
      )}
      {step === "menu" && (
        <section aria-labelledby="pb-services">
          {catalog.branches.length > 1 && (
            <div className="pb-chips" role="group" aria-label="Салбар сонгох">
              {catalog.branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={b.id === branchId}
                  onClick={() => {
                    setBranchId(b.id);
                    setPicked([]);
                    setStaff({});
                  }}
                >
                  <MapPin size={13} /> {b.name}
                </button>
              ))}
            </div>
          )}
          <h2 id="pb-services" className="pb-heading">
            Үйлчилгээ сонгох
            <small>Нэг удаад 2 хүртэл үйлчилгээг 2 ажилтан зэрэг хийнэ.</small>
          </h2>
          <div className="pb-tabs" role="group" aria-label="Ангилал">
            <button
              type="button"
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              Бүгд
            </button>
            {catalog.categories
              .filter((c) => offered.some((s) => s.categoryId === c.id))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
          </div>
          {offered.length ? (
            <ul className="pb-services">
              {offered
                .filter((s) => category === "all" || s.categoryId === category)
                .map((s) => {
                  const on = picked.includes(s.id),
                    full = !on && picked.length >= MAX_SERVICES;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={`pb-service ${on ? "is-on" : ""}`}
                        aria-pressed={on}
                        disabled={full}
                        onClick={() => toggle(s.id)}
                      >
                        <div>
                          <strong>{s.name}</strong>
                          {s.description && <p>{s.description}</p>}
                          <span className="pb-meta">
                            <Clock3 size={12} />{" "}
                            {formatDuration(s.durationMinutes)}
                          </span>
                        </div>
                        <div className="pb-price">
                          {s.listPriceMnt > s.priceMnt && (
                            <>
                              <span className="pb-sale">
                                −
                                {Math.round(
                                  100 - (s.priceMnt / s.listPriceMnt) * 100,
                                )}
                                %
                              </span>
                              <s>{formatMnt(s.listPriceMnt)}</s>
                            </>
                          )}
                          <b
                            className={
                              s.listPriceMnt > s.priceMnt ? "sale-text" : ""
                            }
                          >
                            {formatMnt(s.priceMnt)}
                          </b>
                          <span className="pb-add" aria-hidden="true">
                            {on ? <Check size={15} /> : <Plus size={15} />}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="pb-empty">
              Энэ салбарт онлайн захиалгатай үйлчилгээ алга.
            </p>
          )}
        </section>
      )}
      {step === "time" && (
        <section aria-label="Ажилтан, цаг сонгох">
          {chosen.map((s) => (
            <div className="pb-block" key={s.id}>
              <h2 className="pb-heading">
                {s.name}
                <small>Хэн хийх вэ?</small>
              </h2>
              <div
                className="pb-staff"
                role="group"
                aria-label={`${s.name} ажилтан`}
              >
                <button
                  type="button"
                  aria-pressed={!staff[s.id]}
                  onClick={() => {
                    setStartAt("");
                    setStaff((m) => {
                      const next = { ...m };
                      delete next[s.id];
                      return next;
                    });
                  }}
                >
                  <span className="pb-avatar any">
                    <UserRound size={16} />
                  </span>
                  Аль ч ажилтан
                </button>
                {eligible(s.id).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={staff[s.id] === p.id}
                    onClick={() => {
                      setStartAt("");
                      setStaff((m) => ({ ...m, [s.id]: p.id }));
                    }}
                  >
                    <span className={`pb-avatar tone-${tone(p.id)}`}>
                      {initials(p.name)}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {sameStaff && (
            <p className="pb-error" role="alert">
              Хоёр үйлчилгээг зэрэг хийх тул өөр өөр ажилтан сонгоно уу.
            </p>
          )}
          <h2 className="pb-heading">Өдөр</h2>
          <div className="pb-days" role="group" aria-label="Өдөр сонгох">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={d === date}
                aria-label={d}
                onClick={() => {
                  setDate(d);
                  setStartAt("");
                }}
              >
                <small>{d === today ? "Өнөөдөр" : dayLabel(d)}</small>
                <b>{Number(d.slice(8))}</b>
                <small>{Number(d.slice(5, 7))}-р сар</small>
              </button>
            ))}
          </div>
          <h2 className="pb-heading">
            Цаг
            <small>
              {chosen.length > 1
                ? `Хоёр үйлчилгээ зэрэг эхэлнэ · ${formatDuration(longest)}`
                : formatDuration(longest)}
            </small>
          </h2>
          {loading ? (
            <p className="pb-empty" role="status">
              Сул цаг хайж байна…
            </p>
          ) : grouped.length ? (
            grouped.map((g) => (
              <div key={g.label} className="pb-block">
                <span className="pb-period">{g.label}</span>
                <div className="pb-times" role="group" aria-label={g.label}>
                  {g.times.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={s === startAt}
                      onClick={() => setStartAt(s)}
                    >
                      {localStamp(s).slice(11)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            !sameStaff && (
              <p className="pb-empty">
                Энэ өдөр сул цаг алга. Өөр өдөр сонгоно уу.
              </p>
            )
          )}
        </section>
      )}
      {step === "details" && (
        <form id="pb-details" onSubmit={submit} className="pb-form">
          {/* Honeypot: invisible to people and skipped by keyboard and screen readers. */}
          <input
            ref={trap}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="pb-trap"
          />
          <div className="pb-summary">
            <span>
              <CalendarDays size={14} />
              {startAt && localStamp(startAt).replace("T", " ")} ·{" "}
              {branch?.name}
            </span>
            {chosen.map((s) => (
              <div key={s.id}>
                <span>
                  {s.name}
                  <small>
                    {catalog.staff.find((p) => p.id === staff[s.id])?.name ??
                      "Аль ч ажилтан"}
                  </small>
                </span>
                <b>{formatMnt(s.priceMnt)}</b>
              </div>
            ))}
          </div>
          <label className="field">
            Нэр
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Таны нэр"
            />
          </label>
          <label className="field">
            Утасны дугаар
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="8811 2233"
            />
          </label>
          <p className="pb-note">
            {deposit > 0
              ? `Захиалсны дараа ${formatMnt(deposit)} урьдчилгаа шилжүүлэх дансны мэдээлэл гарна. Мөнгө орсны дараа салон баталгаажуулна.`
              : policy.bookingConfirmationMode === "AUTO_CONFIRM"
                ? "Захиалга шууд баталгаажна."
                : "Салон захиалгыг шалгаад баталгаажуулна."}
          </p>
        </form>
      )}
      {chosen.length > 0 && (
        <div className="pb-bar">
          <div>
            <strong>{formatMnt(total)}</strong>
            <span>
              {chosen.length} үйлчилгээ · {formatDuration(longest)}
              {deposit > 0 && ` · урьдчилгаа ${formatMnt(deposit)}`}
            </span>
          </div>
          {step === "menu" && (
            <button
              type="button"
              className="pb-primary"
              onClick={() => setStep("time")}
            >
              Үргэлжлүүлэх
            </button>
          )}
          {step === "time" && (
            <button
              type="button"
              className="pb-primary"
              disabled={!startAt || Boolean(sameStaff)}
              onClick={() => setStep("details")}
            >
              Үргэлжлүүлэх
            </button>
          )}
          {step === "details" && (
            <button
              type="submit"
              form="pb-details"
              className="pb-primary"
              disabled={sending}
            >
              {sending ? "Илгээж байна…" : "Захиалах"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
