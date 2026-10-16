"use client";
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { localStamp } from "@/lib/business-time";
import { userFacingError } from "@/lib/ui-language";
type Options = {
  branches: { id: string; name: string }[];
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    branchIds: string[];
  }[];
};
// Free times of the salon's other branches, for a receptionist answering the
// phone. Read only: bookings there are made by that branch.
export function BranchSlots({ options }: { options: Options }) {
  const today = localStamp(new Date()).slice(0, 10);
  const [branchId, setBranchId] = useState(options.branches[0]?.id ?? "");
  const offered = options.services.filter((s) =>
    s.branchIds.includes(branchId),
  );
  const [chosen, setChosen] = useState("");
  const serviceId = offered.some((s) => s.id === chosen)
    ? chosen
    : (offered[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<{
    key: string;
    slots?: string[];
    error?: string;
  } | null>(null);
  const key = `${branchId}|${serviceId}|${date}`;
  useEffect(() => {
    if (!branchId || !serviceId || !date) return;
    const controller = new AbortController();
    const q = new URLSearchParams({ branchId, serviceId, date });
    fetch(`/api/availability?${q}`, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        setResult({
          key,
          slots: body.slots.map((s: { startAt: string }) =>
            localStamp(s.startAt).slice(11, 16),
          ),
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error: userFacingError(e, "Сул цагийг ачаалж чадсангүй."),
          });
      });
    return () => controller.abort();
  }, [branchId, serviceId, date, key]);
  if (!options.branches.length) return null;
  const current = result?.key === key ? result : null;
  return (
    <section className="panel branch-slots" aria-label="Бусад салбарын сул цаг">
      <div className="branch-slots-head">
        <span className="role-card-icon">
          <Eye size={15} />
        </span>
        <div>
          <h2>Бусад салбарын сул цаг</h2>
          <p>
            Зөвхөн харах боломжтой. Тухайн салбарт захиалга нэмэх, засах эрх
            танд байхгүй.
          </p>
        </div>
      </div>
      <div className="branch-slots-filters">
        <label className="field">
          Салбар
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
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
            disabled={!offered.length}
            onChange={(e) => setChosen(e.target.value)}
          >
            {offered.length ? (
              offered.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMinutes} мин
                </option>
              ))
            ) : (
              <option value="">Үйлчилгээ алга</option>
            )}
          </select>
        </label>
        <label className="field">
          Өдөр
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      {!serviceId ? (
        <p className="field-hint">Энэ салбарт идэвхтэй үйлчилгээ алга.</p>
      ) : !current ? (
        <p className="field-hint" role="status">
          Сул цагийг хайж байна…
        </p>
      ) : current.error ? (
        <p className="error-message" role="alert">
          {current.error}
        </p>
      ) : current.slots?.length ? (
        <ul className="branch-slot-list" aria-label="Сул цагууд">
          {current.slots.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="field-hint" role="status">
          Энэ өдөр сул цаг алга.
        </p>
      )}
    </section>
  );
}
