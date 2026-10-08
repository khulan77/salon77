"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, UserRound } from "lucide-react";
import type { AdminData, BranchView } from "@/lib/admin-data";
import type { StaffData, ScheduleData } from "@/lib/services/staff";
import type { CatalogData } from "@/lib/services/catalog";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
import { clockTime, parseClock, weekdays } from "@/lib/schedule-time";
import { tone, initials } from "@/lib/avatar";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { Button } from "./ui/button";
import { TimeOffForm } from "./quick-booking";
type Staff = StaffData[number];
type Hours = ScheduleData["hours"];
// Day 1 is Monday, matching WorkingHours.dayOfWeek.
const days = [1, 2, 3, 4, 5, 6, 7];
const short = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
type Shift = { days: number[]; start: string; end: string; dirty: boolean };
function range(s: Shift) {
  const end = s.end === "00:00" ? 1440 : parseClock(s.end);
  return [parseClock(s.start), end];
}
function overlaps(a: Shift | undefined, b: Shift) {
  if (!a) return false;
  const [a1, a2] = range(a),
    [b1, b2] = range(b);
  return a1 < b2 && b1 < a2;
}
function defaultShift(branch?: BranchView): Shift {
  return {
    days: [...days],
    start: clockTime(branch?.openMinute ?? 600),
    end: clockTime(branch?.closeMinute ?? 1140),
    dirty: true,
  };
}
// Current weekly pattern for one branch; unsaved defaults when none exists yet.
function currentShift(
  hours: Hours,
  staffId: string,
  branch: BranchView | undefined,
): Shift {
  const own = hours.filter(
    (h) => h.staffId === staffId && h.branchId === branch?.id && h.active,
  );
  if (!own.length) return defaultShift(branch);
  return {
    days: [...new Set(own.map((h) => h.dayOfWeek))],
    start: clockTime(own[0].startMinute),
    end: own[0].endMinute === 1440 ? "00:00" : clockTime(own[0].endMinute),
    dirty: false,
  };
}
export function StaffDirectory({
  data,
  staff,
  catalog,
  hours,
}: {
  data: AdminData;
  staff: StaffData;
  catalog: CatalogData;
  hours: Hours;
}) {
  const router = useRouter(),
    owner = data.role === "SALON_OWNER";
  const [editing, setEditing] = useState<{
      staff: Staff | null;
      branchId?: string;
    } | null>(null),
    [offFor, setOffFor] = useState<{
      staffId: string;
      branchId: string;
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const unassigned = staff.filter(
    (s) => !s.branchIds.some((id) => data.branches.some((b) => b.id === id)),
  );
  async function toggleActive(s: Staff) {
    if (
      s.active &&
      !window.confirm(
        `«${s.name}»-г идэвхгүй болгох уу? Хуваарь, түүх нь хадгалагдана.`,
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/staff?id=${s.id}`, "PATCH", {
        name: s.name,
        title: s.title,
        phone: s.phone,
        bio: s.bio,
        active: !s.active,
        memberId: s.memberId,
        branchIds: s.branchIds,
        serviceIds: s.serviceIds,
      });
      setMessage(
        s.active ? "Ажилтныг идэвхгүй болголоо." : "Ажилтныг идэвхжүүллээ.",
      );
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Ажилтны төлөвийг өөрчилж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  function card(s: Staff, branch: BranchView | null) {
    const own = hours.filter(
      (h) => h.staffId === s.id && h.branchId === branch?.id && h.active,
    );
    return (
      <article
        className={`panel staff-card ${s.active ? "" : "inactive"}`}
        key={`${branch?.id}-${s.id}`}
      >
        <header>
          <span className={`staff-avatar tone-${tone(s.id)}`}>
            {initials(s.name)}
          </span>
          <div>
            <h3>{s.name}</h3>
            <small>
              {s.phone || "Утасгүй"}
              {!s.active && " · Идэвхгүй"}
            </small>
          </div>
        </header>
        {branch && (
          <Link
            className="week-strip"
            href={`/schedules?staffId=${s.id}`}
            aria-label={`${s.name} · Ажлын хуваарь`}
          >
            {days.map((d, i) => {
              const shift = own
                .filter((h) => h.dayOfWeek === d)
                .sort((a, b) => a.startMinute - b.startMinute);
              return (
                <span
                  key={d}
                  title={
                    shift.length
                      ? `${weekdays[i]} ${shift.map((h) => `${clockTime(h.startMinute)}–${clockTime(h.endMinute)}`).join(", ")}`
                      : `${weekdays[i]} · Амарна`
                  }
                >
                  <small>{short[i]}</small>
                  <b className={shift.length ? "" : "off"}>
                    {shift.length ? clockTime(shift[0].startMinute) : "—"}
                  </b>
                </span>
              );
            })}
          </Link>
        )}
        <footer>
          {owner && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setEditing({ staff: s });
              }}
            >
              Засах
            </button>
          )}
          {branch && s.active && data.role !== "STAFF" && (
            <button
              type="button"
              onClick={() => setOffFor({ staffId: s.id, branchId: branch.id })}
            >
              Чөлөө
            </button>
          )}
          {owner && (
            <button
              type="button"
              disabled={pending || data.preview}
              onClick={() => toggleActive(s)}
            >
              {s.active ? "Идэвхгүй" : "Идэвхжүүлэх"}
            </button>
          )}
          <span>{s.bookingCount ? `${s.bookingCount} захиалга` : ""}</span>
        </footer>
      </article>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ҮЙЛ АЖИЛЛАГАА</div>
          <h1>
            Ажилтнууд<span className="heading-dot">.</span>
          </h1>
          <p>
            {staff.length} ажилтан · {data.branches.length} салбар
          </p>
        </div>
        {owner && (
          <Button
            onClick={() => {
              setError("");
              setEditing({ staff: null });
            }}
          >
            <Plus size={14} />
            Ажилтан нэмэх
          </Button>
        )}
      </div>
      {data.preview && (
        <div className="notice">
          Та танилцах горимд байна. Ажилтан хадгалахын тулд салоноо бүртгэнэ үү.
        </div>
      )}
      {!editing && <Feedback error={error} message={message} />}
      {staff.length ? (
        <>
          {data.branches.map((b) => {
            const people = staff.filter((s) => s.branchIds.includes(b.id));
            return (
              <section className="staff-branch" key={b.id}>
                <div className="staff-branch-head">
                  <h2>
                    {b.name}
                    <small>
                      {clockTime(b.openMinute)}–{clockTime(b.closeMinute)}
                      {!b.active && " · Идэвхгүй"}
                    </small>
                  </h2>
                  {owner && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setError("");
                        setEditing({ staff: null, branchId: b.id });
                      }}
                    >
                      + Ажилтан
                    </button>
                  )}
                </div>
                {people.length ? (
                  <div className="staff-grid">
                    {people.map((s) => card(s, b))}
                  </div>
                ) : (
                  <p className="staff-empty">Энэ салбарт ажилтан алга.</p>
                )}
              </section>
            );
          })}
          {unassigned.length > 0 && (
            <section className="staff-branch">
              <div className="staff-branch-head">
                <h2>Салбаргүй</h2>
              </div>
              <div className="staff-grid">
                {unassigned.map((s) => card(s, null))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <UserRound size={27} />
          </div>
          <h2>Та одоогоор ажилтан нэмээгүй байна.</h2>
          <p>Ажилтан бүртгэхэд заавал нэвтрэх эрх үүсгэх шаардлагагүй.</p>
          {owner && (
            <Button onClick={() => setEditing({ staff: null })}>
              Ажилтан нэмэх
            </Button>
          )}
        </section>
      )}
      <FeatureDialog
        open={!!editing}
        wide
        title={editing?.staff ? "Ажилтан засах" : "Ажилтан нэмэх"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <StaffForm
            data={data}
            catalog={catalog}
            hours={hours}
            current={editing.staff}
            initialBranch={editing.branchId}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setMessage("Ажилтны мэдээллийг хадгаллаа.");
              router.refresh();
            }}
          />
        )}
      </FeatureDialog>
      <FeatureDialog
        open={!!offFor}
        wide
        title="Чөлөө бүртгэх"
        onClose={() => setOffFor(null)}
      >
        {offFor && (
          <div className="quick-booking">
            <TimeOffForm
              options={{
                branches: data.branches,
                services: [],
                staff: staff.map((s) => ({
                  id: s.id,
                  name: s.name,
                  branchIds: s.branchIds,
                  serviceIds: s.serviceIds,
                })),
              }}
              initial={offFor}
              onClose={() => setOffFor(null)}
              onSaved={() => {
                setOffFor(null);
                setMessage("Чөлөөг бүртгэлээ.");
                router.refresh();
              }}
            />
          </div>
        )}
      </FeatureDialog>
    </>
  );
}
function StaffForm({
  data,
  catalog,
  hours,
  current,
  initialBranch,
  onClose,
  onSaved,
}: {
  data: AdminData;
  catalog: CatalogData;
  hours: Hours;
  current: Staff | null;
  initialBranch?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [branchIds, setBranchIds] = useState<string[]>(
      current?.branchIds ??
        (initialBranch
          ? [initialBranch]
          : data.branches.length === 1
            ? [data.branches[0].id]
            : []),
    ),
    [serviceIds, setServiceIds] = useState<string[]>(current?.serviceIds ?? []),
    [shifts, setShifts] = useState<Record<string, Shift>>(() =>
      Object.fromEntries(
        data.branches.map((b) => [
          b.id,
          current ? currentShift(hours, current.id, b) : defaultShift(b),
        ]),
      ),
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  // Only services sold in a chosen branch can be assigned.
  const offered = catalog.services.filter((s) =>
      s.branchIds.some((id) => branchIds.includes(id)),
    ),
    allChecked =
      offered.length > 0 && offered.every((s) => serviceIds.includes(s.id)),
    groups = [
      ...catalog.categories.map((c) => ({
        id: c.id,
        name: c.name,
        services: offered.filter((s) => s.categoryId === c.id),
      })),
      {
        id: "other",
        name: "Бусад",
        services: offered.filter(
          (s) => !catalog.categories.some((c) => c.id === s.categoryId),
        ),
      },
    ].filter((g) => g.services.length);
  // Checking a day in one branch frees it in branches whose hours overlap.
  function updateShift(branchId: string, change: Partial<Shift>) {
    setShifts((all) => {
      const next = {
          ...all,
          [branchId]: { ...all[branchId], ...change, dirty: true },
        },
        mine = next[branchId];
      for (const other of branchIds)
        if (other !== branchId && overlaps(next[other], mine)) {
          const days = next[other].days.filter((d) => !mine.days.includes(d));
          if (days.length !== next[other].days.length)
            next[other] = { ...next[other], days, dirty: true };
        }
      return next;
    });
  }
  function toggleBranch(id: string, on: boolean) {
    setBranchIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
    if (!on) return;
    setShifts((all) => {
      const shift = all[id];
      // Existing saved hours stay; a fresh branch takes only the free days.
      if (!shift.dirty) return all;
      const taken = branchIds
        .filter((other) => overlaps(all[other], shift))
        .flatMap((other) => all[other].days);
      return {
        ...all,
        [id]: { ...shift, days: days.filter((d) => !taken.includes(d)) },
      };
    });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const active = f.get("active") === "on";
    if (
      current?.active &&
      !active &&
      !window.confirm(
        "Ажилтныг идэвхгүй болгох уу? Өмнөх хуваарь хадгалагдана.",
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      await requestJson(
        `/api/staff${current ? `?id=${current.id}` : ""}`,
        current ? "PATCH" : "POST",
        {
          name: f.get("name"),
          title: current?.title ?? "",
          phone: f.get("phone"),
          bio: f.get("bio") ?? "",
          active,
          memberId: f.get("memberId") || null,
          branchIds,
          serviceIds: serviceIds.filter((id) =>
            offered.some((s) => s.id === id),
          ),
          schedule: branchIds
            .filter((id) => shifts[id]?.dirty)
            .map((id) => ({
              branchId: id,
              days: shifts[id].days,
              startMinute: parseClock(shifts[id].start),
              endMinute:
                shifts[id].end === "00:00" ? 1440 : parseClock(shifts[id].end),
            })),
        },
      );
      onSaved();
    } catch (e) {
      setError(
        userFacingError(
          e,
          "Ажилтны мэдээллийг хадгалж чадсангүй. Дахин оролдоно уу.",
        ),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="quick-booking">
      <form
        className="quick-form"
        onSubmit={submit}
        onInvalidCapture={localizeInvalidField}
        onInputCapture={clearFieldValidity}
      >
        <div className="quick-body">
          <Feedback error={error} />
          <div className="form-grid">
            <label className="field">
              Нэр
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={current?.name}
                placeholder="Ажилтны нэр"
              />
            </label>
            <label className="field">
              Утас
              <input
                name="phone"
                type="tel"
                maxLength={30}
                defaultValue={current?.phone}
              />
            </label>
          </div>
          <fieldset className="quick-section plain-fieldset">
            <legend>Ажиллах салбарууд</legend>
            <div className="chip-row">
              {data.branches.map((b) => (
                <label className="check-chip" key={b.id}>
                  <input
                    type="checkbox"
                    checked={branchIds.includes(b.id)}
                    onChange={(e) => toggleBranch(b.id, e.target.checked)}
                  />
                  {b.name}
                  {!b.active && " · Идэвхгүй"}
                </label>
              ))}
            </div>
            {!data.branches.length && (
              <Link href="/branches">Эхлээд салбар нэмнэ үү.</Link>
            )}
          </fieldset>
          <fieldset className="quick-section plain-fieldset">
            <legend>Үзүүлэх үйлчилгээнүүд</legend>
            {offered.length ? (
              <>
                <label className="check-field all-services">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) =>
                      setServiceIds(
                        e.target.checked ? offered.map((s) => s.id) : [],
                      )
                    }
                  />
                  Бүх үйлчилгээ ({offered.length})
                </label>
                {groups.map((g) => (
                  <div className="service-chip-group" key={g.id}>
                    <small>{g.name}</small>
                    <div className="chip-row">
                      {g.services.map((s) => (
                        <label className="check-chip" key={s.id}>
                          <input
                            type="checkbox"
                            checked={serviceIds.includes(s.id)}
                            onChange={(e) =>
                              setServiceIds((ids) =>
                                e.target.checked
                                  ? [...ids, s.id]
                                  : ids.filter((id) => id !== s.id),
                              )
                            }
                          />
                          {s.name}
                          {!s.active && " · Идэвхгүй"}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="field-hint">
                {branchIds.length ? (
                  <Link href="/services">
                    Сонгосон салбарт үйлчилгээ алга. Үйлчилгээ нэмэх
                  </Link>
                ) : (
                  "Эхлээд салбар сонгоно уу."
                )}
              </p>
            )}
          </fieldset>
          {branchIds.length > 0 && (
            <section className="quick-section">
              <h3>Ажлын цаг</h3>
              <p className="field-hint">
                Салбарын цагаар автоматаар тохирно. Амралтын өдрийг сонголтоос
                хасна уу.
              </p>
              {data.branches
                .filter((b) => branchIds.includes(b.id))
                .map((b) => {
                  const shift = shifts[b.id];
                  return (
                    <div className="shift-editor" key={b.id}>
                      <strong>{b.name}</strong>
                      <div
                        className="day-toggles"
                        role="group"
                        aria-label={`${b.name} · Ажиллах өдрүүд`}
                      >
                        {days.map((d, i) => (
                          <label key={d} title={weekdays[i]}>
                            <input
                              type="checkbox"
                              aria-label={`${b.name} · ${weekdays[i]}`}
                              checked={shift.days.includes(d)}
                              onChange={(e) =>
                                updateShift(b.id, {
                                  days: e.target.checked
                                    ? [...shift.days, d].sort()
                                    : shift.days.filter((x) => x !== d),
                                })
                              }
                            />
                            <span>{short[i]}</span>
                          </label>
                        ))}
                      </div>
                      <div className="shift-times">
                        <input
                          type="time"
                          required
                          step={900}
                          aria-label={`${b.name} · Эхлэх цаг`}
                          value={shift.start}
                          onChange={(e) =>
                            updateShift(b.id, { start: e.target.value })
                          }
                        />
                        <span>—</span>
                        <input
                          type="time"
                          required
                          step={900}
                          aria-label={`${b.name} · Дуусах цаг`}
                          value={shift.end}
                          onChange={(e) =>
                            updateShift(b.id, { end: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              {current && (
                <Link
                  className="text-link"
                  href={`/schedules?staffId=${current.id}`}
                >
                  Завсарлага, өдөр бүрийн өөр цагийг нарийвчлан тохируулах
                </Link>
              )}
            </section>
          )}
          <details className="quick-section">
            <summary>Нэмэлт мэдээлэл</summary>
            <label className="field">
              Товч танилцуулга
              <textarea
                name="bio"
                maxLength={2000}
                defaultValue={current?.bio}
              />
            </label>
            <label className="field">
              Холбох гишүүн
              <select name="memberId" defaultValue={current?.memberId ?? ""}>
                <option value="">Нэвтрэх эрхтэй холбохгүй</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {!m.active && " · Идэвхгүй"}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-hint">
              Холбосон гишүүн өөрийн хуваарь, захиалгаа харна.
            </p>
          </details>
          <label className="check-field">
            <input
              type="checkbox"
              name="active"
              defaultChecked={current?.active ?? true}
            />
            Идэвхтэй
          </label>
        </div>
        <div className="quick-footer">
          <p>
            {branchIds.length} салбар ·{" "}
            {serviceIds.filter((id) => offered.some((s) => s.id === id)).length}{" "}
            үйлчилгээ
          </p>
          <Button type="button" variant="outline" onClick={onClose}>
            Цуцлах
          </Button>
          <Button disabled={pending || data.preview || !branchIds.length}>
            {pending ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </div>
      </form>
    </div>
  );
}
