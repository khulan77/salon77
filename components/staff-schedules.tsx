"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, CalendarDays, Pencil, Trash2 } from "lucide-react";
import type { AdminData } from "@/lib/admin-data";
import type { ScheduleData } from "@/lib/services/staff";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
import {
  weekdays,
  clockTime,
  parseClock,
  localDateTime,
  localToISO,
  nextDate,
} from "@/lib/schedule-time";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { Button } from "./ui/button";
type Hours = ScheduleData["hours"][number];
type TimeOff = ScheduleData["timeOff"][number];
export function StaffSchedules({
  data,
  schedule,
  initialStaff,
}: {
  data: AdminData;
  schedule: ScheduleData;
  initialStaff?: string;
}) {
  const router = useRouter(),
    write = ["SALON_OWNER", "MANAGER"].includes(data.role);
  const [staffId, setStaffId] = useState(
    schedule.staff.some((s) => s.id === initialStaff)
      ? initialStaff!
      : (schedule.staff[0]?.id ?? ""),
  );
  const [branchId, setBranchId] = useState("all");
  const [hours, setHours] = useState<Hours | "new" | null>(null),
    [off, setOff] = useState<TimeOff | "new" | null>(null);
  const [breaks, setBreaks] = useState<
      { startMinute: number; endMinute: number }[]
    >([]),
    [working, setWorking] = useState(true),
    [fullDay, setFullDay] = useState(true);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const staff = schedule.staff.find((s) => s.id === staffId),
    branches = data.branches.filter((b) => staff?.branchIds.includes(b.id));
  const current = hours && hours !== "new" ? hours : null,
    currentOff = off && off !== "new" ? off : null;
  function editHours(h: Hours | "new") {
    setError("");
    setHours(h);
    setBreaks(h === "new" ? [] : h.breaks);
    setWorking(h === "new" ? true : h.active);
  }
  function editOff(t: TimeOff | "new") {
    setError("");
    setOff(t);
    setFullDay(t === "new" ? true : t.fullDay);
  }
  async function remove(kind: "working-hours" | "time-off", id: string) {
    if (!window.confirm("Энэ бүртгэлийг устгах уу?")) return;
    setError("");
    setPending(true);
    try {
      await requestJson(`/api/${kind}?id=${id}`, "DELETE");
      setMessage("Бүртгэлийг устгалаа.");
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Устгаж чадсангүй. Дахин оролдоно уу."));
    } finally {
      setPending(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const f = new FormData(e.currentTarget);
    try {
      if (hours)
        await requestJson(
          `/api/working-hours${current ? `?id=${current.id}` : ""}`,
          current ? "PATCH" : "POST",
          {
            staffId,
            branchId: f.get("branchId"),
            dayOfWeek: Number(f.get("dayOfWeek")),
            startMinute: working ? parseClock(String(f.get("start"))) : 0,
            endMinute: working ? parseClock(String(f.get("end"))) : 1440,
            active: working,
            breaks: working ? breaks : [],
          },
        );
      else {
        const start = String(f.get("start")),
          end = String(f.get("end"));
        await requestJson(
          `/api/time-off${currentOff ? `?id=${currentOff.id}` : ""}`,
          currentOff ? "PATCH" : "POST",
          {
            staffId,
            branchId: f.get("branchId"),
            fullDay,
            startsAt: localToISO(fullDay ? `${start}T00:00` : start),
            endsAt: localToISO(fullDay ? `${nextDate(end)}T00:00` : end),
            reason: f.get("reason"),
          },
        );
      }
      setHours(null);
      setOff(null);
      setMessage("Хуваарийг хадгаллаа.");
      router.refresh();
    } catch (e) {
      setError(
        userFacingError(
          e,
          "Хуваарийг хадгалж чадсангүй. Эхлэх болон дуусах цагийг шалгана уу.",
        ),
      );
    } finally {
      setPending(false);
    }
  }
  const visibleHours = schedule.hours.filter(
      (h) =>
        h.staffId === staffId &&
        (branchId === "all" || h.branchId === branchId),
    ),
    visibleOff = schedule.timeOff.filter(
      (t) =>
        t.staffId === staffId &&
        (branchId === "all" || t.branchId === branchId),
    );
  const branchName = (id: string) =>
    data.branches.find((b) => b.id === id)?.name ?? "";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ҮЙЛ АЖИЛЛАГАА</div>
          <h1>
            Ажлын хуваарь<span className="heading-dot">.</span>
          </h1>
          <p>
            Долоо хоногийн ажлын цаг, завсарлага, чөлөө. Улаанбаатарын цагаар.
          </p>
        </div>
        {write && staff && (
          <div className="heading-controls">
            <Button onClick={() => editHours("new")}>
              <Plus size={14} />
              Ажлын цаг нэмэх
            </Button>
            <Button variant="outline" onClick={() => editOff("new")}>
              Чөлөө нэмэх
            </Button>
          </div>
        )}
      </div>
      {data.preview && (
        <div className="notice">
          Та танилцах горимд байна. Хуваарь тохируулахын тулд эхлээд ажилтан
          нэмнэ үү.
        </div>
      )}
      {!hours && !off && <Feedback error={error} message={message} />}
      {schedule.staff.length ? (
        <>
          <div className="feature-toolbar">
            <label className="field">
              Ажилтан сонгох
              <select
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  setBranchId("all");
                }}
              >
                {schedule.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {!s.active && " · Идэвхгүй"}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Салбараар шүүх
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="all">Бүх салбар</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="schedule-week">
            {weekdays.map((day, i) => (
              <section className="panel schedule-day" key={day}>
                <h2>{day}</h2>
                {visibleHours.filter((h) => h.dayOfWeek === i + 1).length ? (
                  visibleHours
                    .filter((h) => h.dayOfWeek === i + 1)
                    .map((h) => (
                      <div className="schedule-period" key={h.id}>
                        <strong>
                          {h.active
                            ? `${clockTime(h.startMinute)} — ${clockTime(h.endMinute)}`
                            : "Амарна"}
                        </strong>
                        <p>{branchName(h.branchId)}</p>
                        {h.breaks.map((b, j) => (
                          <p className="field-hint" key={j}>
                            Завсарлага: {clockTime(b.startMinute)} —{" "}
                            {clockTime(b.endMinute)}
                          </p>
                        ))}
                        {write && (
                          <div className="schedule-actions">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editHours(h)}
                              aria-label={`${day} хуваарь засах`}
                            >
                              <Pencil size={12} />
                              Засах
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => remove("working-hours", h.id)}
                              aria-label={`${day} хуваарь устгах`}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <p className="field-hint">Хуваарь тохируулаагүй · Амарна</p>
                )}
              </section>
            ))}
          </div>
          <section className="panel time-off-panel">
            <div className="section-heading">
              <h2>Чөлөө, амралт</h2>
              {write && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => editOff("new")}
                >
                  Чөлөө нэмэх
                </Button>
              )}
            </div>
            {visibleOff.length ? (
              visibleOff.map((t) => (
                <article className="time-off-row" key={t.id}>
                  <div>
                    <strong>
                      {localDateTime(t.startsAt).replace("T", " ")} —{" "}
                      {localDateTime(t.endsAt).replace("T", " ")}
                    </strong>
                    <p>
                      {branchName(t.branchId)} ·{" "}
                      {t.fullDay ? "Бүтэн өдөр" : "Хэсэгчилсэн чөлөө"}
                    </p>
                    {t.reason && <p>{t.reason}</p>}
                  </div>
                  {write && (
                    <div className="schedule-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editOff(t)}
                      >
                        Засах
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => remove("time-off", t.id)}
                        aria-label="Чөлөө устгах"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="field-hint">Одоогоор чөлөө бүртгээгүй байна.</p>
            )}
          </section>
        </>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <CalendarDays size={27} />
          </div>
          <h2>Одоогоор харах хуваарь алга.</h2>
          <p>
            {data.role === "STAFF"
              ? "Таны ажилтны бүртгэл болон салбарын эрхийг эзэмшигч тохируулсны дараа хуваарь харагдана."
              : "Эхлээд ажилтнаа бүртгэж, ажиллах салбарт нь хуваарилаарай."}
          </p>
          {data.role === "SALON_OWNER" && (
            <Button asChild>
              <Link href="/employees">Ажилтан нэмэх</Link>
            </Button>
          )}
        </section>
      )}
      <FeatureDialog
        open={!!hours || !!off}
        title={
          hours
            ? current
              ? "Ажлын цаг засах"
              : "Ажлын цаг нэмэх"
            : currentOff
              ? "Чөлөө засах"
              : "Чөлөө нэмэх"
        }
        onClose={() => {
          setHours(null);
          setOff(null);
        }}
      >
        <Feedback error={error} />
        <form
          onSubmit={submit}
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearFieldValidity}
        >
          <p>{staff?.name} · Улаанбаатарын цаг</p>
          <label className="field">
            Салбар
            <select
              name="branchId"
              required
              defaultValue={
                current?.branchId ??
                currentOff?.branchId ??
                (branchId !== "all" ? branchId : branches[0]?.id)
              }
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {!b.active && " · Идэвхгүй"}
                </option>
              ))}
            </select>
          </label>
          {hours ? (
            <>
              <label className="field">
                Гараг
                <select name="dayOfWeek" defaultValue={current?.dayOfWeek ?? 1}>
                  {weekdays.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={working}
                  onChange={(e) => setWorking(e.target.checked)}
                />
                Ажиллана
              </label>
              {working && (
                <>
                  <div className="form-grid">
                    <label className="field">
                      Эхлэх цаг
                      <input
                        type="time"
                        name="start"
                        required
                        defaultValue={clockTime(current?.startMinute ?? 600)}
                      />
                    </label>
                    <label className="field">
                      Дуусах цаг
                      <input
                        type="time"
                        name="end"
                        required
                        defaultValue={
                          current?.endMinute === 1440
                            ? "23:59"
                            : clockTime(current?.endMinute ?? 1140)
                        }
                      />
                    </label>
                  </div>
                  <fieldset>
                    <legend>Завсарлагууд</legend>
                    {breaks.map((b, i) => (
                      <div className="break-row" key={i}>
                        <label className="field">
                          Эхлэх цаг
                          <input
                            type="time"
                            required
                            value={clockTime(b.startMinute)}
                            onChange={(e) =>
                              setBreaks(
                                breaks.map((v, j) =>
                                  j === i
                                    ? {
                                        ...v,
                                        startMinute: parseClock(e.target.value),
                                      }
                                    : v,
                                ),
                              )
                            }
                          />
                        </label>
                        <label className="field">
                          Дуусах цаг
                          <input
                            type="time"
                            required
                            value={clockTime(b.endMinute)}
                            onChange={(e) =>
                              setBreaks(
                                breaks.map((v, j) =>
                                  j === i
                                    ? {
                                        ...v,
                                        endMinute: parseClock(e.target.value),
                                      }
                                    : v,
                                ),
                              )
                            }
                          />
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Завсарлага устгах"
                          onClick={() => {
                            if (window.confirm("Энэ завсарлагыг устгах уу?"))
                              setBreaks(breaks.filter((_, j) => j !== i));
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setBreaks([
                          ...breaks,
                          { startMinute: 780, endMinute: 840 },
                        ])
                      }
                    >
                      Завсарлага нэмэх
                    </Button>
                  </fieldset>
                </>
              )}
            </>
          ) : (
            <>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={fullDay}
                  onChange={(e) => setFullDay(e.target.checked)}
                />
                Бүтэн өдөр
              </label>
              <div className="form-grid" key={String(fullDay)}>
                <label className="field">
                  Эхлэх {fullDay ? "өдөр" : "хугацаа"}
                  <input
                    type={fullDay ? "date" : "datetime-local"}
                    name="start"
                    required
                    defaultValue={
                      currentOff
                        ? fullDay
                          ? localDateTime(currentOff.startsAt).slice(0, 10)
                          : localDateTime(currentOff.startsAt)
                        : undefined
                    }
                  />
                </label>
                <label className="field">
                  Дуусах {fullDay ? "өдөр" : "хугацаа"}
                  <input
                    type={fullDay ? "date" : "datetime-local"}
                    name="end"
                    required
                    defaultValue={
                      currentOff
                        ? fullDay
                          ? localDateTime(
                              new Date(
                                new Date(currentOff.endsAt).getTime() - 1,
                              ).toISOString(),
                            ).slice(0, 10)
                          : localDateTime(currentOff.endsAt)
                        : undefined
                    }
                  />
                </label>
              </div>
              {fullDay && (
                <p className="field-hint">
                  Сонгосон эхлэх, дуусах өдрийг бүтнээр нь хамруулна.
                </p>
              )}
              <label className="field">
                Шалтгаан · заавал биш
                <textarea
                  name="reason"
                  maxLength={500}
                  defaultValue={currentOff?.reason}
                  placeholder="Жишээ: Сургалт"
                />
              </label>
              <p className="field-hint">
                Шалтгааныг зөвхөн эзэмшигч, эрхтэй менежер, тухайн ажилтан
                харна.
              </p>
            </>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setHours(null);
                setOff(null);
              }}
            >
              Цуцлах
            </Button>
            <Button disabled={pending || data.preview || !staff?.active}>
              {pending ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </div>
        </form>
      </FeatureDialog>
    </>
  );
}
