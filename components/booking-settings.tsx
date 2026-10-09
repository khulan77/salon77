"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarCheck,
  Clock3,
  MessageSquare,
  ImagePlus,
  Landmark,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "./ui/button";
import { Feedback } from "./ui/feature-dialog";
import { NotificationLog } from "./notification-log";
import { requestJson } from "@/lib/client-request";
import { clockTime } from "@/lib/schedule-time";
import type { BranchView } from "@/lib/admin-data";
import { formatDuration, formatMnt, userFacingError } from "@/lib/ui-language";
import {
  REMINDER_OPTIONS,
  defaultBookingSettings,
  depositAmount,
  type BookingPolicy,
} from "@/lib/booking-settings";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
export type SampleService = {
  name: string;
  priceMnt: number;
  listPriceMnt: number;
  durationMinutes: number;
};
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export function BookingSettings({
  preview,
  salonName,
  slug,
  coverUrl: initialCover,
  services,
  branches = [],
  smsReady = false,
}: {
  preview: boolean;
  salonName: string;
  slug: string;
  coverUrl: string | null;
  services: SampleService[];
  branches?: BranchView[];
  smsReady?: boolean;
}) {
  const [policy, setPolicy] = useState<BookingPolicy>(defaultBookingSettings);
  const [cover, setCover] = useState(initialCover);
  const [loading, setLoading] = useState(!preview),
    [loaded, setLoaded] = useState(preview),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    fetch("/api/booking-settings", { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!controller.signal.aborted) {
          setPolicy(data);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            userFacingError(
              e,
              "Тохиргоог ачаалж чадсангүй. Хуудсаа дахин ачаална уу.",
            ),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [preview]);
  const update = (next: Partial<BookingPolicy>) => {
    setMessage("");
    setPolicy({ ...policy, ...next });
  };
  const number = (key: keyof BookingPolicy) => ({
    value: Number.isNaN(policy[key]) ? "" : (policy[key] as number),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      update({ [key]: e.target.valueAsNumber }),
  });
  const sample = services[0]?.priceMnt ?? 65000;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">САЛОНЫ ТОХИРГОО</div>
          <h1>
            Тохиргоо<span className="heading-dot">.</span>
          </h1>
          <p>
            Онлайн захиалгын хуудас, урьдчилгаа болон захиалгын нөхцөлөө
            тохируулаарай.
          </p>
        </div>
        {slug && (
          <div className="heading-controls">
            <Button variant="outline" asChild>
              <a href={`/${slug}/book`} target="_blank" rel="noreferrer">
                Захиалгын хуудас нээх <ArrowUpRight size={15} />
              </a>
            </Button>
          </div>
        )}
      </div>
      {preview && (
        <p className="notice">
          Та танилцах горимд байна. Тохиргоо хадгалахын тулд салоноо бүртгэнэ
          үү.
        </p>
      )}
      <div className="settings-layout">
        <div className="settings-main">
          <CoverCard
            cover={cover}
            disabled={preview}
            onChange={(url) => setCover(url)}
          />
          <Feedback error={error} message={message} />
          {loading ? (
            <section className="panel settings-card">
              <p role="status">Тохиргоог ачаалж байна…</p>
            </section>
          ) : (
            <form
              onInvalidCapture={localizeInvalidField}
              onInputCapture={clearFieldValidity}
              onSubmit={async (e) => {
                e.preventDefault();
                if (preview || saving || !loaded) return;
                setSaving(true);
                setError("");
                setMessage("");
                try {
                  setPolicy(
                    await requestJson<BookingPolicy>(
                      "/api/booking-settings",
                      "PATCH",
                      policy,
                    ),
                  );
                  setMessage("Тохиргоог хадгаллаа.");
                } catch (e) {
                  setError(userFacingError(e, "Тохиргоог хадгалж чадсангүй."));
                } finally {
                  setSaving(false);
                }
              }}
            >
              <fieldset
                className="settings-fieldset"
                disabled={saving || !loaded}
              >
                <section
                  className="panel settings-card"
                  aria-labelledby="online-title"
                >
                  <div className="settings-card-heading">
                    <span className="settings-icon">
                      <CalendarCheck size={17} />
                    </span>
                    <div>
                      <h2 id="online-title">Онлайн захиалга</h2>
                      <p>Үйлчлүүлэгчид цахим хуудсаар цаг захиалах нөхцөл.</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={policy.publicBookingEnabled}
                        onChange={(e) =>
                          update({ publicBookingEnabled: e.target.checked })
                        }
                      />
                      <span aria-hidden="true" />
                      Онлайн захиалга авах
                    </label>
                  </div>
                  <p className="field-hint">
                    Хаасан үед ресепшн болон эзэмшигч захиалга бүртгэх боломжтой
                    хэвээр байна.
                  </p>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={policy.listedInDirectory}
                      onChange={(e) =>
                        update({ listedInDirectory: e.target.checked })
                      }
                    />
                    Salon77 нүүр хуудсанд салоноо харуулах
                  </label>
                  <p className="field-hint">
                    Онлайн захиалга нээлттэй, үйлчилгээтэй үед үйлчлүүлэгчид
                    таныг нүүр хуудаснаас хайж олно. Унтраасан ч захиалгын линк
                    тань ажилласаар байна.
                  </p>
                  <div className="settings-subtitle">
                    Захиалга баталгаажуулах
                  </div>
                  <div className="option-cards" role="radiogroup">
                    {(
                      [
                        [
                          "MANUAL_CONFIRM",
                          "Гараар баталгаажуулах",
                          "Ресепшн шалгаад баталгаажуулна.",
                        ],
                        [
                          "AUTO_CONFIRM",
                          "Автоматаар баталгаажуулах",
                          "Захиалга шууд баталгаажна.",
                        ],
                      ] as const
                    ).map(([value, title, text]) => (
                      <label className="option-card" key={value}>
                        <input
                          type="radio"
                          name="confirmation"
                          checked={policy.bookingConfirmationMode === value}
                          onChange={() =>
                            update({ bookingConfirmationMode: value })
                          }
                        />
                        <strong>{title}</strong>
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>
                  {policy.depositRequired &&
                    policy.bookingConfirmationMode === "AUTO_CONFIRM" && (
                      <p className="field-hint">
                        Урьдчилгаа авдаг үед онлайн захиалга мөнгө орсныг шалгах
                        хүртэл «Хүлээгдэж буй» байна.
                      </p>
                    )}
                  <label className="field">
                    Баталгаажаагүй онлайн захиалгыг автоматаар цуцлах
                    <select
                      value={policy.pendingExpiryMinutes}
                      onChange={(e) =>
                        update({ pendingExpiryMinutes: Number(e.target.value) })
                      }
                    >
                      <option value={0}>Цуцлахгүй</option>
                      <option value={30}>30 минутын дараа</option>
                      <option value={60}>1 цагийн дараа</option>
                      <option value={120}>2 цагийн дараа</option>
                      <option value={360}>6 цагийн дараа</option>
                      <option value={1440}>24 цагийн дараа</option>
                    </select>
                    <small>
                      Хугацаандаа баталгаажаагүй (жишээ нь урьдчилгаа ороогүй)
                      захиалга цуцлагдаж, цаг нь дахин сул болно. Хуурамч
                      захиалгаар цаг дүүргэхээс хамгаална.
                    </small>
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      Урьдчилж захиалах хугацаа · хоног
                      <input
                        required
                        type="number"
                        min={0}
                        max={365}
                        step={1}
                        {...number("advanceBookingDays")}
                      />
                      <small>0 бол зөвхөн өнөөдөр захиална.</small>
                    </label>
                    <label className="field">
                      Хамгийн багадаа хэдэн минутын өмнө
                      <input
                        required
                        type="number"
                        min={0}
                        max={525600}
                        step={1}
                        {...number("minimumBookingNoticeMinutes")}
                      />
                      <small>Онлайн захиалгад үйлчилнэ.</small>
                    </label>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      Цагийн алхам
                      <select
                        value={policy.slotIntervalMinutes}
                        onChange={(e) =>
                          update({
                            slotIntervalMinutes: Number(e.target.value) as
                              15 | 30,
                          })
                        }
                      >
                        <option value={15}>15 минут</option>
                        <option value={30}>30 минут</option>
                      </select>
                      <small>Онлайн болон гар захиалгад үйлчилнэ.</small>
                    </label>
                    <label className="field">
                      Цуцлах мэдэгдлийн хугацаа · минут
                      <input
                        required
                        type="number"
                        min={0}
                        max={525600}
                        step={1}
                        {...number("cancellationNoticeMinutes")}
                      />
                      <small>
                        Үйлчлүүлэгч захиалгын холбоосоороо энэ хугацаанаас өмнө
                        цуцалж, цагаа өөрчилнө. Салон календараас хүссэн үедээ
                        өөрчилнө.
                      </small>
                    </label>
                  </div>
                </section>
                <section
                  className="panel settings-card"
                  aria-labelledby="notify-title"
                >
                  <div className="settings-card-heading">
                    <span className="settings-icon">
                      <MessageSquare size={17} />
                    </span>
                    <div>
                      <h2 id="notify-title">Мэдэгдэл</h2>
                      <p>
                        Захиалга хүлээн авах, баталгаажих, цуцлагдах, цаг
                        өөрчлөгдөхөд үйлчлүүлэгчид мессеж илгээнэ.
                      </p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={policy.notificationsEnabled}
                        onChange={(e) =>
                          update({ notificationsEnabled: e.target.checked })
                        }
                      />
                      <span aria-hidden="true" />
                      Мессеж мэдэгдэл
                    </label>
                  </div>
                  {!smsReady && (
                    <p className="notice">
                      Мессеж илгээх үйлчилгээ хараахан холбогдоогүй. Мэдэгдлүүд
                      бүртгэлд хадгалагдах боловч илгээгдэхгүй.
                    </p>
                  )}
                  <div className="settings-subtitle">Сануулга</div>
                  <div
                    className="choice-chips"
                    role="group"
                    aria-label="Сануулга илгээх хугацаа"
                  >
                    {REMINDER_OPTIONS.map((m) => (
                      <label className="check-field" key={m}>
                        <input
                          type="checkbox"
                          checked={policy.reminderMinutes.includes(m)}
                          onChange={(e) =>
                            update({
                              reminderMinutes: e.target.checked
                                ? [...policy.reminderMinutes, m]
                                : policy.reminderMinutes.filter((x) => x !== m),
                            })
                          }
                        />
                        {m >= 1440
                          ? `${m / 1440} өдрийн өмнө`
                          : `${m / 60} цагийн өмнө`}
                      </label>
                    ))}
                  </div>
                  <p className="field-hint">
                    Зөвхөн баталгаажсан захиалгад, сонгосон хугацаанд сануулга
                    илгээнэ. Цуцлагдсан эсвэл цаг нь өөрчлөгдсөн захиалгын
                    хуучин сануулга автоматаар цуцлагдана.
                  </p>
                  <div className="settings-subtitle">Сүүлийн мэдэгдлүүд</div>
                  <NotificationLog preview={preview} />
                </section>
                <section
                  className="panel settings-card"
                  aria-labelledby="hours-title"
                >
                  <div className="settings-card-heading">
                    <span className="settings-icon">
                      <Clock3 size={17} />
                    </span>
                    <div>
                      <h2 id="hours-title">Ажлын цаг</h2>
                      <p>
                        Ажилтнууд хэдэн цагаас хэдэн цаг хүртэл захиалга авах
                        вэ.
                      </p>
                    </div>
                  </div>
                  <div className="option-cards" role="radiogroup">
                    {(
                      [
                        [
                          "SALON_HOURS",
                          "Салоны цагаар",
                          "Бүх ажилтан салбарын нээх–хаах цагаар ажиллана. Амралтын өдрийг цагийн бүртгэлд «А» гэж тэмдэглэнэ.",
                        ],
                        [
                          "CUSTOM",
                          "Ажилтан бүр өөрийн хуваариар",
                          "Ажилтны мэдээлэл дээр гараг, цаг, завсарлагыг тус тусад нь тохируулна.",
                        ],
                      ] as const
                    ).map(([value, title, text]) => (
                      <label className="option-card" key={value}>
                        <input
                          type="radio"
                          name="staffHours"
                          checked={policy.staffHoursMode === value}
                          onChange={() => update({ staffHoursMode: value })}
                        />
                        <strong>{title}</strong>
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>
                  {branches.length > 0 && (
                    <ul className="branch-hours">
                      {branches.map((b) => (
                        <li key={b.id}>
                          <span>{b.name}</span>
                          <b>
                            {clockTime(b.openMinute)} –{" "}
                            {clockTime(b.closeMinute)}
                          </b>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="field-hint">
                    Салбарын нээх, хаах цагийг{" "}
                    <Link href="/branches" className="text-link">
                      Салбарууд
                    </Link>{" "}
                    хэсгээс өөрчилнө.{" "}
                    {policy.staffHoursMode === "SALON_HOURS"
                      ? "Ажилтны өөрийн хуваарь устахгүй, зүгээр л ашиглагдахгүй."
                      : "Ажилтанд хуваарь тохируулаагүй бол тэр захиалга авахгүй."}
                  </p>
                </section>
                <section
                  className="panel settings-card"
                  aria-labelledby="deposit-title"
                >
                  <div className="settings-card-heading">
                    <span className="settings-icon warm">
                      <Wallet size={17} />
                    </span>
                    <div>
                      <h2 id="deposit-title">Урьдчилгаа</h2>
                      <p>Онлайн захиалгад урьдчилгаа төлбөр авах эсэх.</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={policy.depositRequired}
                        onChange={(e) =>
                          update({ depositRequired: e.target.checked })
                        }
                      />
                      <span aria-hidden="true" />
                      Урьдчилгаа авах
                    </label>
                  </div>
                  {policy.depositRequired ? (
                    <>
                      <div className="form-grid">
                        <div className="field">
                          Урьдчилгааны төрөл
                          <div
                            className="segmented"
                            role="group"
                            aria-label="Урьдчилгааны төрөл"
                          >
                            <button
                              type="button"
                              aria-pressed={policy.depositType === "PERCENT"}
                              onClick={() =>
                                update({
                                  depositType: "PERCENT",
                                  depositValue: Math.min(
                                    policy.depositValue || 30,
                                    100,
                                  ),
                                })
                              }
                            >
                              Хувиар
                            </button>
                            <button
                              type="button"
                              aria-pressed={policy.depositType === "FIXED"}
                              onClick={() =>
                                update({
                                  depositType: "FIXED",
                                  depositValue: 20000,
                                })
                              }
                            >
                              Тогтмол дүн
                            </button>
                          </div>
                        </div>
                        <label className="field">
                          {policy.depositType === "PERCENT"
                            ? "Урьдчилгааны хувь · %"
                            : "Урьдчилгааны дүн · ₮"}
                          <input
                            required
                            type="number"
                            min={1}
                            max={
                              policy.depositType === "PERCENT"
                                ? 100
                                : 1000000000
                            }
                            step={1}
                            {...number("depositValue")}
                          />
                          <small>
                            Жишээ нь {formatMnt(sample)} үйлчилгээнд{" "}
                            <b>
                              {formatMnt(depositAmount(sample, policy) || 0)}
                            </b>{" "}
                            урьдчилгаа.
                          </small>
                        </label>
                      </div>
                      <div className="settings-subtitle">
                        <Landmark size={14} /> Шилжүүлэх данс
                      </div>
                      <div className="form-grid three">
                        <label className="field">
                          Банк
                          <input
                            required
                            maxLength={100}
                            placeholder="Жишээ: Хаан банк"
                            value={policy.depositBankName}
                            onChange={(e) =>
                              update({ depositBankName: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          Дансны дугаар
                          <input
                            required
                            maxLength={100}
                            inputMode="numeric"
                            placeholder="5000 1234 56"
                            value={policy.depositAccountNumber}
                            onChange={(e) =>
                              update({ depositAccountNumber: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          Данс эзэмшигч
                          <input
                            required
                            maxLength={100}
                            placeholder={salonName}
                            value={policy.depositAccountHolder}
                            onChange={(e) =>
                              update({ depositAccountHolder: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <p className="field-hint">
                        Үйлчлүүлэгч захиалсны дараа энэ дансны мэдээлэл болон
                        гүйлгээний утга (утасны дугаар) харна. Мөнгө орсныг
                        шалгаад захиалгыг календараас баталгаажуулна уу.
                        Ресепшнээр бүртгэсэн захиалгад урьдчилгаа шаардахгүй.
                      </p>
                    </>
                  ) : (
                    <p className="field-hint">
                      Урьдчилгаа авахгүй. Үйлчлүүлэгч төлбөрөө салон дээр төлнө.
                    </p>
                  )}
                </section>
                <div className="settings-save">
                  <span>
                    {message || "Өөрчлөлт баруун талын жишээнд шууд харагдана."}
                  </span>
                  <Button disabled={preview || saving || !loaded}>
                    {saving ? "Хадгалж байна…" : "Хадгалах"}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
        </div>
        <BookingPreview
          salonName={salonName}
          cover={cover}
          policy={policy}
          services={services}
        />
      </div>
    </>
  );
}
function CoverCard({
  cover,
  disabled,
  onChange,
}: {
  cover: string | null;
  disabled: boolean;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(method: "POST" | "DELETE", file?: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      if (file) body.set("file", file);
      const response = await fetch("/api/salon-cover", {
        method,
        body: file ? body : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      onChange(data.coverUrl ?? null);
    } catch (e) {
      setError(
        userFacingError(e, "Зургийг хадгалж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="panel settings-card" aria-labelledby="cover-title">
      <div className="settings-card-heading">
        <span className="settings-icon">
          <ImagePlus size={17} />
        </span>
        <div>
          <h2 id="cover-title">Салоны нүүр зураг</h2>
          <p>Онлайн захиалгын хуудасны дээд хэсэгт харагдана.</p>
        </div>
      </div>
      <div className="cover-editor">
        <button
          type="button"
          className={`cover-drop ${cover ? "has-image" : ""}`}
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
          aria-label={cover ? "Нүүр зураг солих" : "Нүүр зураг оруулах"}
        >
          {cover ? (
            <Image src={cover} alt="" fill unoptimized sizes="480px" />
          ) : (
            <span>
              <ImagePlus size={22} />
              {busy ? "Хуулж байна…" : "Зураг оруулах"}
            </span>
          )}
        </button>
        <div className="cover-actions">
          <p>
            Салоныхоо бодит орчны тод зургийг сонгоорой. Зураг · 4 МБ хүртэл.
            Хэвтээ (16:9) зураг хамгийн сайхан харагдана.
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busy}
              onClick={() => input.current?.click()}
            >
              {busy ? "Хуулж байна…" : cover ? "Зураг солих" : "Зураг сонгох"}
            </Button>
            {cover && (
              <button
                type="button"
                className="text-action"
                disabled={disabled || busy}
                onClick={() => {
                  if (window.confirm("Нүүр зургийг устгах уу?"))
                    void send("DELETE");
                }}
              >
                <Trash2 size={13} /> Устгах
              </button>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          aria-label="Нүүр зургийн файл"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_IMAGE_BYTES)
              return setError("Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
            void send("POST", file);
          }}
        />
      </div>
    </section>
  );
}
function BookingPreview({
  salonName,
  cover,
  policy,
  services,
}: {
  salonName: string;
  cover: string | null;
  policy: BookingPolicy;
  services: SampleService[];
}) {
  const first = services[0];
  const deposit = first ? depositAmount(first.priceMnt, policy) : 0;
  return (
    <aside
      className="settings-preview"
      aria-label="Үйлчлүүлэгчид харагдах байдал"
    >
      <span className="settings-preview-label">
        Үйлчлүүлэгчид харагдах байдал
      </span>
      <div className="phone-frame">
        <div className="phone-cover">
          {cover ? (
            <Image src={cover} alt="" fill unoptimized sizes="320px" />
          ) : (
            <span>{salonName.trim().charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="phone-body">
          <strong className="phone-salon">{salonName}</strong>
          <p>Өөрт тохирох цагаа сонгоорой.</p>
          {!policy.publicBookingEnabled ? (
            <div className="phone-closed">
              Онлайн захиалга одоогоор хаалттай байна.
            </div>
          ) : (
            <>
              <div className="phone-steps" aria-hidden="true">
                <i className="on" />
                <i />
                <i />
                <i />
              </div>
              {(services.length ? services : [null]).map((s, i) => (
                <div className="phone-service" key={s?.name ?? i}>
                  {s ? (
                    <>
                      <div>
                        <b>{s.name}</b>
                        <span>
                          <Clock3 size={10} />{" "}
                          {formatDuration(s.durationMinutes)}
                        </span>
                      </div>
                      <div className="phone-price">
                        {s.listPriceMnt > s.priceMnt && (
                          <s>{formatMnt(s.listPriceMnt)}</s>
                        )}
                        <b
                          className={
                            s.listPriceMnt > s.priceMnt ? "sale-text" : ""
                          }
                        >
                          {formatMnt(s.priceMnt)}
                        </b>
                      </div>
                    </>
                  ) : (
                    <span className="phone-empty">
                      Онлайн захиалгатай үйлчилгээ нэмэгдэхээр энд харагдана.
                    </span>
                  )}
                </div>
              ))}
              {policy.depositRequired && (
                <div className="phone-deposit">
                  <Wallet size={12} />
                  <span>
                    Урьдчилгаа{" "}
                    {policy.depositType === "PERCENT"
                      ? `${policy.depositValue || 0}%`
                      : formatMnt(policy.depositValue || 0)}
                    {first && deposit > 0 && ` · ${formatMnt(deposit)}`}
                    {policy.depositBankName && ` · ${policy.depositBankName}`}
                  </span>
                </div>
              )}
              <div className="phone-button">Цаг сонгох</div>
              <small className="phone-note">
                {policy.depositRequired
                  ? "Урьдчилгаа шилжүүлсний дараа салон баталгаажуулна."
                  : policy.bookingConfirmationMode === "AUTO_CONFIRM"
                    ? "Захиалга шууд баталгаажна."
                    : "Салон захиалгыг гараар баталгаажуулна."}
              </small>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
