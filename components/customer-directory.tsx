"use client";
import { useEffect, useState } from "react";
import type { customerDetail, listCustomers } from "@/lib/services/customers";
import { localStamp } from "@/lib/business-time";
import { statusLabels } from "@/lib/booking-validation";
import { userFacingError } from "@/lib/ui-language";
import { requestJson } from "@/lib/client-request";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
type CustomerList = Awaited<ReturnType<typeof listCustomers>>;
type Detail = Awaited<ReturnType<typeof customerDetail>>;
export function CustomerDirectory({
  preview,
  owner,
  initialId,
}: {
  preview: boolean;
  owner: boolean;
  initialId?: string;
}) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [result, setResult] = useState<CustomerList>({ customers: [], total: 0 }),
    [selected, setSelected] = useState(initialId ?? ""),
    [detail, setDetail] = useState<Detail | null>(null),
    [historyPage, setHistoryPage] = useState(0),
    [loading, setLoading] = useState(!preview),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(
        `/api/customers?search=${encodeURIComponent(search)}&page=${page}`,
        { signal: controller.signal },
      )
        .then(async (r) => {
          const b = await r.json();
          if (!r.ok) throw new Error(b.error);
          setResult(b);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(userFacingError(e, "Үйлчлүүлэгчдийг ачаалж чадсангүй."));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [preview, search, page, refresh]);
  useEffect(() => {
    if (!selected || preview) return;
    const controller = new AbortController();
    fetch(
      `/api/customers?id=${encodeURIComponent(selected)}&page=${historyPage}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setDetail(b);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(userFacingError(e, "Үйлчлүүлэгч олдсонгүй."));
      });
    return () => controller.abort();
  }, [selected, historyPage, preview, refresh]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ҮЙЛЧЛҮҮЛЭГЧИД</div>
          <h1>
            Үйлчлүүлэгчид<span className="heading-dot">.</span>
          </h1>
          <p>Холбоо барих мэдээлэл, захиалгын түүх.</p>
        </div>
      </div>
      {preview && (
        <div className="notice">
          Та танилцах горимд байна. Үйлчлүүлэгч захиалга үүсгэх үед бүртгэгдэнэ.
        </div>
      )}
      {!selected && <Feedback error={error} message={message} />}
      <label className="field customer-search">
        Хайх
        <input
          placeholder="Нэр эсвэл утасны дугаар"
          value={search}
          maxLength={100}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </label>
      {loading ? (
        <p role="status">Ачаалж байна…</p>
      ) : result.customers.length ? (
        <div className="branch-grid">
          {result.customers.map((c) => (
            <button
              className="panel customer-card"
              key={c.id}
              onClick={() => {
                setDetail(null);
                setError("");
                setHistoryPage(0);
                setSelected(c.id);
              }}
            >
              <h2>{c.name}</h2>
              <p>{c.phone}</p>
              <p>Нийт захиалга: {c.totalBookings}</p>
              <p>
                Сүүлд үйлчлүүлсэн:{" "}
                {c.lastVisit
                  ? localStamp(c.lastVisit).replace("T", " ")
                  : "Одоогоор алга"}
              </p>
              <p>
                Дараагийн захиалга:{" "}
                {c.upcoming
                  ? localStamp(c.upcoming).replace("T", " ")
                  : "Одоогоор алга"}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <section className="panel empty-page">
          <h2>Үйлчлүүлэгч олдсонгүй.</h2>
          <p>Шинэ захиалга үүсгэх үед үйлчлүүлэгчээ бүртгээрэй.</p>
        </section>
      )}
      <div className="form-actions">
        <Button
          variant="outline"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Өмнөх
        </Button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(result.total / 30))}
        </span>
        <Button
          variant="outline"
          disabled={(page + 1) * 30 >= result.total}
          onClick={() => setPage(page + 1)}
        >
          Дараах
        </Button>
      </div>
      <FeatureDialog
        open={!!selected}
        title="Үйлчлүүлэгчийн дэлгэрэнгүй"
        onClose={() => {
          setSelected("");
          setDetail(null);
        }}
      >
        <Feedback error={error} message={message} />
        {detail ? (
          <>
            <form
              key={`${detail.customer.id}-${refresh}`}
              onInvalidCapture={localizeInvalidField}
              onInputCapture={clearFieldValidity}
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                const f = new FormData(e.currentTarget);
                try {
                  await requestJson(`/api/customers?id=${selected}`, "PATCH", {
                    name: f.get("name"),
                    phone: f.get("phone"),
                    email: f.get("email"),
                    notes: f.get("notes"),
                  });
                  setMessage("Үйлчлүүлэгчийн мэдээллийг хадгаллаа.");
                  setRefresh(refresh + 1);
                } catch (e) {
                  setError(userFacingError(e, "Мэдээллийг хадгалж чадсангүй."));
                } finally {
                  setPending(false);
                }
              }}
            >
              <label className="field">
                Нэр
                <input
                  name="name"
                  required
                  maxLength={100}
                  readOnly={!owner}
                  defaultValue={detail.customer.name}
                />
              </label>
              <label className="field">
                Утас
                <input
                  name="phone"
                  required
                  maxLength={40}
                  readOnly={!owner}
                  defaultValue={detail.customer.phone}
                />
              </label>
              <label className="field">
                Имэйл
                <input
                  type="email"
                  name="email"
                  readOnly={!owner}
                  defaultValue={detail.customer.email}
                />
              </label>
              {owner && (
                <>
                  <label className="field">
                    Хувийн тэмдэглэл
                    <textarea
                      name="notes"
                      maxLength={2000}
                      defaultValue={detail.customer.notes}
                    />
                  </label>
                  <Button disabled={pending}>
                    {pending ? "Хадгалж байна…" : "Хадгалах"}
                  </Button>
                </>
              )}
            </form>
            <h3 className="history-title">Захиалгын түүх ба ирэх захиалгууд</h3>
            {detail.history.map((b) => (
              <article className="time-off-row" key={b.id}>
                <div>
                  <strong>{localStamp(b.startAt).replace("T", " ")}</strong>
                  <p>
                    {b.serviceName} · {b.priceMnt.toLocaleString("en-US")}₮
                  </p>
                  <p>
                    {b.staffName} · {b.branchName} · {statusLabels[b.status]}
                  </p>
                </div>
              </article>
            ))}
            {!detail.history.length && <p>Одоогоор захиалга алга.</p>}
            <div className="form-actions">
              <Button
                variant="outline"
                disabled={!historyPage}
                onClick={() => setHistoryPage(historyPage - 1)}
              >
                Өмнөх
              </Button>
              <Button
                variant="outline"
                disabled={(historyPage + 1) * 30 >= detail.total}
                onClick={() => setHistoryPage(historyPage + 1)}
              >
                Дараах
              </Button>
            </div>
          </>
        ) : (
          !error && <p role="status">Ачаалж байна…</p>
        )}
      </FeatureDialog>
    </>
  );
}
