"use client";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Phone } from "lucide-react";
import type { ManagedVisit } from "@/lib/services/manage";
import { addDays, localStamp } from "@/lib/business-time";
import { formatMnt, userFacingError } from "@/lib/ui-language";
const weekdays = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
const statusText: Record<string, string> = {
  CONFIRMED: "Баталгаажсан",
  PENDING: "Салон баталгаажуулахыг хүлээж байна",
  CANCELLED: "Цуцлагдсан",
  CLOSED: "Дууссан",
};
function noticeText(minutes: number) {
  if (!minutes) return "Цаг эхлэхээс өмнө хүссэн үедээ";
  if (minutes % 1440 === 0)
    return `Цаг эхлэхээс ${minutes / 1440} өдрийн өмнө хүртэл`;
  if (minutes % 60 === 0)
    return `Цаг эхлэхээс ${minutes / 60} цагийн өмнө хүртэл`;
  return `Цаг эхлэхээс ${minutes} минутын өмнө хүртэл`;
}
export function ManageVisit({
  slug,
  token,
  initial,
}: {
  slug: string;
  token: string;
  initial: ManagedVisit | null;
}) {
  const [visit, setVisit] = useState(initial);
  const [mode, setMode] = useState<"view" | "move">("view");
  const today = localStamp(new Date()).slice(0, 10);
  const [date, setDate] = useState(today);
  const [found, setFound] = useState<{ key: string; slots: string[] } | null>(
    null,
  );
  const [startAt, setStartAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const api = `/api/public/${encodeURIComponent(slug)}/manage`;
  const key = mode === "move" ? date : null;
  const loading = key !== null && found?.key !== key;
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(`${api}?${new URLSearchParams({ token, date: key })}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setFound({
          key,
          slots: data.slots.map((s: { startAt: string }) => s.startAt),
        });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setFound({ key, slots: [] });
        setError(userFacingError(e, "Сул цагийг ачаалж чадсангүй."));
      });
    return () => controller.abort();
  }, [api, key, token]);
  if (!visit)
    return (
      <div className="pb">
        <section className="pb-done">
          <h1>Захиалга олдсонгүй</h1>
          <p>
            Холбоос буруу эсвэл хугацаа нь дууссан байна. Салон руу залгана уу.
          </p>
        </section>
      </div>
    );
  async function act(body: Record<string, string>, message: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      setVisit(data);
      setMode("view");
      setStartAt("");
      setFound(null);
      setDone(message);
    } catch (e) {
      setError(userFacingError(e, "Хадгалж чадсангүй. Дахин оролдоно уу."));
    } finally {
      setBusy(false);
    }
  }
  const slots = found && found.key === key ? found.slots : [];
  const original = visit.startAt;
  return (
    <div className="pb">
      <section className="pb-manage">
        <h1>Таны захиалга</h1>
        <span className={`pb-state ${visit.status.toLowerCase()}`}>
          {statusText[visit.status]}
        </span>
        {done && (
          <p className="pb-ok" role="status">
            {done}
          </p>
        )}
        <div className="pb-ticket">
          <strong>{visit.salonName}</strong>
          <span>
            <CalendarDays size={14} />
            {localStamp(visit.startAt).replace("T", " ")}
          </span>
          <span>
            <MapPin size={14} />
            {visit.branchName}
            {visit.branchAddress && `, ${visit.branchAddress}`}
          </span>
          {visit.items.map((i) => (
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
            <b>{formatMnt(visit.totalMnt)}</b>
          </div>
        </div>
        {error && (
          <p className="pb-error" role="alert">
            {error}
          </p>
        )}
        {visit.canChange ? (
          mode === "view" ? (
            <>
              <p className="pb-note">
                {noticeText(visit.noticeMinutes)} онлайнаар цуцлах, цагаа
                өөрчлөх боломжтой.
              </p>
              <div className="pb-actions">
                <button
                  type="button"
                  className="pb-primary"
                  onClick={() => {
                    setError("");
                    setDone("");
                    const day = localStamp(original).slice(0, 10);
                    setDate(day < today ? today : day);
                    setMode("move");
                  }}
                >
                  Цаг өөрчлөх
                </button>
                <button
                  type="button"
                  className="pb-secondary danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Захиалгаа цуцлах уу?"))
                      void act({ action: "cancel" }, "Захиалга цуцлагдлаа.");
                  }}
                >
                  Захиалга цуцлах
                </button>
              </div>
            </>
          ) : (
            <div className="pb-move">
              <h2 className="pb-heading">
                Шинэ цаг сонгох
                <small>Ажилтан, үйлчилгээ өөрчлөгдөхгүй.</small>
              </h2>
              <div className="pb-days" role="group" aria-label="Өдөр сонгох">
                {Array.from({ length: 21 }, (_, i) => addDays(today, i)).map(
                  (d) => (
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
                      <small>
                        {d === today
                          ? "Өнөөдөр"
                          : weekdays[new Date(`${d}T12:00:00Z`).getUTCDay()]}
                      </small>
                      <b>{Number(d.slice(8))}</b>
                      <small>{Number(d.slice(5, 7))}-р сар</small>
                    </button>
                  ),
                )}
              </div>
              {loading ? (
                <p className="pb-empty" role="status">
                  Сул цаг хайж байна…
                </p>
              ) : slots.length ? (
                <div className="pb-times" role="group" aria-label="Цаг сонгох">
                  {slots.map((s) => (
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
              ) : (
                <p className="pb-empty">
                  Энэ өдөр сул цаг алга. Өөр өдөр сонгоно уу.
                </p>
              )}
              <div className="pb-actions">
                <button
                  type="button"
                  className="pb-primary"
                  disabled={!startAt || startAt === original || busy}
                  onClick={() =>
                    act(
                      { action: "reschedule", startAt },
                      "Цаг амжилттай өөрчлөгдлөө.",
                    )
                  }
                >
                  {busy ? "Хадгалж байна…" : "Энэ цагаар солих"}
                </button>
                <button
                  type="button"
                  className="pb-secondary"
                  onClick={() => setMode("view")}
                >
                  Болих
                </button>
              </div>
            </div>
          )
        ) : (
          visit.status !== "CANCELLED" &&
          visit.status !== "CLOSED" && (
            <p className="pb-note">
              Онлайнаар цуцлах, өөрчлөх хугацаа өнгөрсөн. Салон руу залгана уу.
            </p>
          )
        )}
        {visit.phone && (
          <a className="pb-call" href={`tel:${visit.phone}`}>
            <Phone size={15} /> Салон руу залгах · {visit.phone}
          </a>
        )}
      </section>
    </div>
  );
}
