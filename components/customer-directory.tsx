"use client";
import { useEffect, useState } from "react";
import type { customerDetail, listCustomers } from "@/lib/services/customers";
import { localStamp } from "@/lib/business-time";
import { statusLabels } from "@/lib/booking-validation";
import { ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { formatMnt, formatDayLabel, userFacingError } from "@/lib/ui-language";
import { initials } from "@/lib/avatar";
import { requestJson } from "@/lib/client-request";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
type CustomerList = Awaited<ReturnType<typeof listCustomers>>;
// "9918 6455" for local numbers; others as stored.
function formatPhone(phone: string) {
  const local = phone.replace(/^\+976/, "");
  return /^\d{8}$/.test(local)
    ? `${local.slice(0, 4)} ${local.slice(4)}`
    : phone;
}
// "өнөөдөр", "өчигдөр", "3 өдрийн өмнө", "маргааш" or the date.
function relativeDay(iso: string) {
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;
  const diff =
    day(localStamp(iso).slice(0, 10)) -
    day(localStamp(new Date()).slice(0, 10));
  if (diff === 0) return "өнөөдөр";
  if (diff === -1) return "өчигдөр";
  if (diff === 1) return "маргааш";
  if (diff < 0 && diff > -7) return `${-diff} өдрийн өмнө`;
  if (diff > 0 && diff < 7) return `${diff} өдрийн дараа`;
  return formatDayLabel(localStamp(iso).slice(0, 10), false);
}
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
  async function remove(c: CustomerList["customers"][number]) {
    if (
      !window.confirm(
        `«${c.name}»-г устгах уу? Түүний ${c.visits} захиалгын түүх хамт устана. Буцаах боломжгүй.`,
      )
    )
      return;
    setError("");
    setMessage("");
    try {
      await requestJson(
        `/api/customers?id=${encodeURIComponent(c.id)}`,
        "DELETE",
      );
      setMessage(`«${c.name}»-г устгалаа.`);
      setRefresh((r) => r + 1);
    } catch (e) {
      setError(userFacingError(e, "Үйлчлүүлэгчийг устгаж чадсангүй."));
    }
  }
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
      <div className="customer-toolbar">
        <label className="customer-search-box">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            aria-label="Үйлчлүүлэгч хайх"
            placeholder="Нэр эсвэл утасны дугаараар хайх"
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {!loading && result.total > 0 && (
          <span className="customer-count">
            Нийт <b>{result.total}</b> үйлчлүүлэгч
          </span>
        )}
      </div>
      {loading && !result.total && !result.customers.length ? (
        <p role="status" className="customer-loading">
          Ачаалж байна…
        </p>
      ) : result.customers.length ? (
        <div
          className={`panel customer-table ${loading ? "is-refreshing" : ""}`}
          aria-busy={loading}
        >
          <div className="customer-head" aria-hidden="true">
            <span>Үйлчлүүлэгч</span>
            <span>Сүүлд ирсэн</span>
            <span>Сүүлийн үйлчилгээ</span>
            <span>Ирсэн</span>
            <span>Нийт зарцуулсан</span>
          </div>
          <ul className="customer-list">
            {result.customers.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="customer-row"
                  onClick={() => {
                    setDetail(null);
                    setError("");
                    setHistoryPage(0);
                    setSelected(c.id);
                  }}
                >
                  <span className="customer-who">
                    <span className="customer-avatar" aria-hidden="true">
                      {initials(c.name)}
                    </span>
                    <span>
                      <strong>{c.name}</strong>
                      <small>{formatPhone(c.phone)}</small>
                    </span>
                  </span>
                  <span className="customer-cell">
                    {c.lastAt ? relativeDay(c.lastAt) : "—"}
                  </span>
                  <span className="customer-cell customer-service">
                    {c.lastService || "—"}
                  </span>
                  <span className="customer-cell customer-visits">
                    {c.visits} удаа
                  </span>
                  <span className="customer-cell customer-spent">
                    {formatMnt(c.spentMnt)}
                  </span>
                </button>
                {owner && (
                  <button
                    type="button"
                    className="customer-delete"
                    aria-label={`${c.name} устгах`}
                    title="Устгах"
                    disabled={preview}
                    onClick={() => remove(c)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <section className="panel empty-page">
          <h2>Үйлчлүүлэгч олдсонгүй.</h2>
          <p>
            {search
              ? "Өөр нэр эсвэл дугаараар хайгаад үзээрэй."
              : "Шинэ захиалга үүсгэх үед үйлчлүүлэгч автоматаар бүртгэгдэнэ."}
          </p>
        </section>
      )}
      {result.total > 30 && (
        <nav className="customer-pager" aria-label="Хуудаслалт">
          <span>
            {page * 30 + 1}–{Math.min((page + 1) * 30, result.total)} /{" "}
            {result.total}
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label="Өмнөх хуудас"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Дараах хуудас"
            disabled={(page + 1) * 30 >= result.total}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </nav>
      )}
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
            <h3 className="history-title">
              Захиалгын түүх
              <span>{detail.total}</span>
            </h3>
            {detail.history.length ? (
              <ul className="customer-history">
                {detail.history.map((b) => (
                  <li key={b.id}>
                    <div>
                      <strong>{b.serviceName}</strong>
                      <small>
                        {formatDayLabel(localStamp(b.startAt).slice(0, 10))} ·{" "}
                        {localStamp(b.startAt).slice(11)} · {b.staffName} ·{" "}
                        {b.branchName}
                      </small>
                    </div>
                    <div>
                      <b>{formatMnt(b.priceMnt)}</b>
                      <span
                        className={`customer-status status-${b.status.toLowerCase()}`}
                      >
                        {statusLabels[b.status]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="customer-history-empty">Одоогоор захиалга алга.</p>
            )}
            {detail.total > 30 && (
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
            )}
          </>
        ) : (
          !error && <p role="status">Ачаалж байна…</p>
        )}
      </FeatureDialog>
    </>
  );
}
