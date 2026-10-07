"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Feedback } from "./ui/feature-dialog";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
import {
  defaultBookingSettings,
  type BookingPolicy,
} from "@/lib/booking-settings";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
export function BookingSettings({ preview }: { preview: boolean }) {
  const [policy, setPolicy] = useState<BookingPolicy>(defaultBookingSettings);
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
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">САЛОНЫ ТОХИРГОО</div>
          <h1>
            Тохиргоо<span className="heading-dot">.</span>
          </h1>
          <p>Салоныхоо захиалгын нөхцөлийг тохируулаарай.</p>
        </div>
      </div>
      <section className="panel" style={{ padding: 24, maxWidth: 720 }}>
        <h2>Захиалгын тохиргоо</h2>
        {preview && (
          <p className="notice">
            Та танилцах горимд байна. Тохиргоо хадгалахын тулд салоноо бүртгэнэ
            үү.
          </p>
        )}
        <Feedback error={error} message={message} />
        {loading ? (
          <p role="status">Тохиргоог ачаалж байна…</p>
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
                setMessage("Захиалгын тохиргоог хадгаллаа.");
              } catch (e) {
                setError(userFacingError(e, "Тохиргоог хадгалж чадсангүй."));
              } finally {
                setSaving(false);
              }
            }}
          >
            <fieldset
              disabled={saving || !loaded}
              style={{ border: 0, padding: 0 }}
            >
              <label className="checklist-item">
                <input
                  type="checkbox"
                  checked={policy.publicBookingEnabled}
                  onChange={(e) => {
                    setMessage("");
                    setPolicy({
                      ...policy,
                      publicBookingEnabled: e.target.checked,
                    });
                  }}
                />
                Онлайн захиалга авах
              </label>
              <p className="field-hint">
                Хаасан үед ресепшн болон эзэмшигч захиалга бүртгэх боломжтой
                хэвээр байна.
              </p>
              <label className="field">
                Захиалга баталгаажуулах
                <select
                  value={policy.bookingConfirmationMode}
                  onChange={(e) => {
                    setMessage("");
                    setPolicy({
                      ...policy,
                      bookingConfirmationMode: e.target
                        .value as BookingPolicy["bookingConfirmationMode"],
                    });
                  }}
                >
                  <option value="MANUAL_CONFIRM">Гараар баталгаажуулах</option>
                  <option value="AUTO_CONFIRM">
                    Автоматаар баталгаажуулах
                  </option>
                </select>
              </label>
              {(
                [
                  [
                    "advanceBookingDays",
                    "Урьдчилж захиалах хугацаа · хоног",
                    365,
                    "0 бол зөвхөн өнөөдөр захиална.",
                  ],
                  [
                    "minimumBookingNoticeMinutes",
                    "Хэдэн минутын өмнө захиалах вэ?",
                    525600,
                    "Онлайн захиалгад үйлчилнэ. 0 бол нэмэлт хүлээлтгүй.",
                  ],
                  [
                    "cancellationNoticeMinutes",
                    "Цуцлах мэдэгдлийн хугацаа · минут",
                    525600,
                    "Одоогоор зөвхөн нөхцөлийг хадгална. Үйлчлүүлэгч өөрөө захиалга цуцлах боломж хараахан нээгдээгүй.",
                  ],
                ] as const
              ).map(([key, label, max, hint]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    required
                    type="number"
                    min={0}
                    max={max}
                    step={1}
                    value={policy[key]}
                    onChange={(e) => {
                      setMessage("");
                      setPolicy({
                        ...policy,
                        [key]:
                          e.target.value === ""
                            ? ("" as unknown as number)
                            : Number(e.target.value),
                      });
                    }}
                  />
                  <span className="field-hint">{hint}</span>
                </label>
              ))}
              <label className="field">
                Цагийн алхам
                <select
                  value={policy.slotIntervalMinutes}
                  onChange={(e) => {
                    setMessage("");
                    setPolicy({
                      ...policy,
                      slotIntervalMinutes: Number(e.target.value) as 15 | 30,
                    });
                  }}
                >
                  <option value={15}>15 минут</option>
                  <option value={30}>30 минут</option>
                </select>
                <span className="field-hint">
                  Онлайн болон гар захиалгын боломжит цагт үйлчилнэ. Өмнөх
                  захиалгыг өөрчлөхгүй.
                </span>
              </label>
              <div className="form-actions">
                <Button disabled={preview || saving || !loaded}>
                  {saving ? "Хадгалж байна…" : "Хадгалах"}
                </Button>
              </div>
            </fieldset>
          </form>
        )}
      </section>
    </>
  );
}
