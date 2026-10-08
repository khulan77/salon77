"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Scissors,
  Pencil,
  X,
  Flame,
  MapPin,
  ChevronDown,
} from "lucide-react";
import type { AdminData } from "@/lib/admin-data";
import type { CatalogData } from "@/lib/services/catalog";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { requestJson } from "@/lib/client-request";
import {
  DISCOUNT_PRESETS,
  MAX_DISCOUNT_PERCENT,
  discountedPrice,
} from "@/lib/pricing";
import { formatDuration, formatMnt, userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
type Service = CatalogData["services"][number];
type Category = CatalogData["categories"][number];
const saveFailed = "Үйлчилгээг хадгалж чадсангүй. Дахин оролдоно уу.";
const deactivateConfirm = "Идэвхгүй болгох уу? Өмнөх мэдээлэл хадгалагдана.";
function payload(s: Service, active = s.active) {
  return {
    name: s.name,
    categoryId: s.categoryId,
    description: s.description,
    priceMnt: s.priceMnt,
    durationMinutes: s.durationMinutes,
    discountPercent: s.discountPercent,
    onlineBookable: s.onlineBookable,
    active,
    branchIds: s.branchIds,
  };
}
export function ServiceCatalog({
  data,
  catalog,
}: {
  data: AdminData;
  catalog: CatalogData;
}) {
  const router = useRouter();
  const owner = data.role === "SALON_OWNER";
  const [service, setService] = useState<Service | "new" | null>(null);
  const [category, setCategory] = useState<Category | "new" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState("all");
  const [branch, setBranch] = useState("all");
  const current = service && service !== "new" ? service : null;
  const currentCategory = category && category !== "new" ? category : null;
  const selectedCategory = catalog.categories.find((c) => c.id === filter);
  const categoryName = (id: string) =>
    catalog.categories.find((c) => c.id === id)?.name ?? "";
  function openService(next: Service | "new" | null) {
    setError("");
    setMessage("");
    setService(next);
  }
  async function run(work: () => Promise<unknown>, done: string) {
    setError("");
    setPending(true);
    try {
      await work();
      setService(null);
      setCategory(null);
      setMessage(done);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, saveFailed));
    } finally {
      setPending(false);
    }
  }
  function submitService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const active = form.get("active") === "on";
    if (current?.active && !active && !window.confirm(deactivateConfirm))
      return;
    void run(
      () =>
        requestJson(
          `/api/services${current ? `?id=${current.id}` : ""}`,
          current ? "PATCH" : "POST",
          {
            name: form.get("name"),
            categoryId: form.get("categoryId"),
            description: form.get("description"),
            priceMnt: Number(form.get("priceMnt")),
            durationMinutes: Number(form.get("durationMinutes")),
            discountPercent: Number(form.get("discountPercent") || 0),
            onlineBookable: form.get("onlineBookable") === "on",
            active,
            branchIds: form.getAll("branches"),
          },
        ),
      "Мэдээллийг хадгаллаа.",
    );
  }
  function submitCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const active = form.get("active") === "on";
    if (
      currentCategory?.active &&
      !active &&
      !window.confirm(deactivateConfirm)
    )
      return;
    void run(
      () =>
        requestJson(
          `/api/categories${currentCategory ? `?id=${currentCategory.id}` : ""}`,
          currentCategory ? "PATCH" : "POST",
          {
            name: form.get("name"),
            sortOrder: Number(form.get("sortOrder")),
            active,
          },
        ),
      "Мэдээллийг хадгаллаа.",
    );
  }
  function toggleActive(s: Service) {
    if (s.active && !window.confirm(deactivateConfirm)) return;
    void run(
      () =>
        requestJson(`/api/services?id=${s.id}`, "PATCH", payload(s, !s.active)),
      s.active ? "Үйлчилгээг идэвхгүй болголоо." : "Үйлчилгээг идэвхжүүллээ.",
    );
  }
  const visible = catalog.services.filter(
    (s) =>
      (filter === "all" || s.categoryId === filter) &&
      (branch === "all" || s.branchIds.includes(branch)),
  );
  const online = catalog.services.filter(
    (s) => s.active && s.onlineBookable,
  ).length;
  const discounted = catalog.services.filter(
    (s) => s.active && s.discountPercent > 0,
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ҮЙЛ АЖИЛЛАГАА</div>
          <h1>
            Үйлчилгээнүүд<span className="heading-dot">.</span>
          </h1>
          <p>
            {catalog.services.length ? (
              <>
                Нийт {catalog.services.length} үйлчилгээ · {online} нь онлайн
                {discounted > 0 && (
                  <>
                    {" "}
                    · <b className="sale-text">{discounted} нь хямдралтай</b>
                  </>
                )}
                .
              </>
            ) : (
              "Үнэ, хугацаа болон үйлчилгээ үзүүлэх салбаруудаа тохируулаарай."
            )}
          </p>
        </div>
        {owner && (
          <div className="heading-controls">
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                setCategory("new");
              }}
            >
              <Plus size={14} />
              Ангилал нэмэх
            </Button>
            {service ? (
              <Button variant="outline" onClick={() => openService(null)}>
                <X size={14} />
                Болих
              </Button>
            ) : (
              <Button onClick={() => openService("new")}>
                <Plus size={14} />
                Үйлчилгээ нэмэх
              </Button>
            )}
          </div>
        )}
      </div>
      {data.preview && (
        <div className="notice">
          Та танилцах горимд байна. Үйлчилгээ хадгалахын тулд салоноо бүртгэнэ
          үү.
        </div>
      )}
      {!category && <Feedback error={error} message={message} />}
      {service && (
        <ServiceEditor
          key={current?.id ?? "new"}
          service={current}
          data={data}
          catalog={catalog}
          pending={pending}
          onSubmit={submitService}
          onCancel={() => openService(null)}
        />
      )}
      <div className="catalog-toolbar">
        <div className="segmented" role="group" aria-label="Ангиллаар шүүх">
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Бүгд
            <span className="tab-count" aria-hidden="true">
              {catalog.services.length}
            </span>
          </button>
          {catalog.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              className={c.active ? "" : "is-inactive"}
              onClick={() => setFilter(c.id)}
            >
              {c.name}
              {!c.active && " · Идэвхгүй"}
              <span className="tab-count" aria-hidden="true">
                {catalog.services.filter((s) => s.categoryId === c.id).length}
              </span>
            </button>
          ))}
        </div>
        {owner && selectedCategory && (
          <button
            type="button"
            className="text-action quiet"
            aria-label={`${selectedCategory.name} ангилал засах`}
            onClick={() => {
              setError("");
              setCategory(selectedCategory);
            }}
          >
            <Pencil size={12} /> Ангилал засах
          </button>
        )}
        {data.branches.length > 1 && (
          <span className="select-wrap catalog-branch">
            <MapPin size={14} />
            <select
              aria-label="Салбараар шүүх"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="all">Бүх салбар</option>
              {data.branches.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </span>
        )}
      </div>
      {visible.length ? (
        <ul className="service-list">
          {visible.map((s) => (
            <li
              key={s.id}
              className={`service-row ${s.active ? "" : "is-inactive"} ${
                current?.id === s.id ? "is-editing" : ""
              }`}
            >
              <span className="service-thumb" aria-hidden="true">
                {s.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="service-row-body">
                <div className="service-row-title">
                  <h2>{s.name}</h2>
                  {s.discountPercent > 0 && (
                    <span className="service-tag sale">
                      <Flame size={11} aria-hidden="true" />−{s.discountPercent}
                      %
                    </span>
                  )}
                  {s.active && s.onlineBookable && (
                    <span className="service-tag online">Онлайн</span>
                  )}
                  {!s.active && <span className="service-tag">Идэвхгүй</span>}
                </div>
                <p>
                  {categoryName(s.categoryId)} ·{" "}
                  <PriceTag price={s.priceMnt} discount={s.discountPercent} /> ·{" "}
                  {formatDuration(s.durationMinutes)}
                </p>
                <p className="service-row-branches">
                  {data.branches
                    .filter((b) => s.branchIds.includes(b.id))
                    .map((b) => b.name)
                    .join(", ") || "Салбар сонгоогүй"}
                </p>
              </div>
              {owner && (
                <div className="service-row-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${s.name} засах`}
                    onClick={() => openService(s)}
                  >
                    <Pencil size={13} />
                    Засах
                  </Button>
                  <button
                    type="button"
                    className="text-action"
                    disabled={pending || data.preview}
                    onClick={() => toggleActive(s)}
                  >
                    {s.active ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <Scissors size={27} />
          </div>
          <h2>
            {catalog.services.length
              ? "Тохирох үйлчилгээ алга"
              : "Та одоогоор үйлчилгээ нэмээгүй байна."}
          </h2>
          <p>Эхлээд ангилал үүсгээд, үйлчилгээний үнэ, хугацааг оруулаарай.</p>
          {owner && !service && (
            <Button onClick={() => openService("new")}>
              <Plus size={14} />
              Үйлчилгээ нэмэх
            </Button>
          )}
        </section>
      )}
      <FeatureDialog
        open={!!category}
        title={currentCategory ? "Ангилал засах" : "Ангилал нэмэх"}
        onClose={() => setCategory(null)}
      >
        <Feedback error={error} />
        <form
          onSubmit={submitCategory}
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearFieldValidity}
        >
          <label className="field">
            Ангиллын нэр
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={currentCategory?.name}
              placeholder="Жишээ: Хумс"
            />
          </label>
          <label className="field">
            Эрэмбэ
            <input
              type="number"
              name="sortOrder"
              required
              min={0}
              max={10000}
              step={1}
              defaultValue={currentCategory?.sortOrder ?? 0}
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              name="active"
              defaultChecked={currentCategory?.active ?? true}
            />
            Идэвхтэй
          </label>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCategory(null)}
            >
              Цуцлах
            </Button>
            <Button disabled={pending || data.preview}>
              {pending ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </div>
        </form>
      </FeatureDialog>
    </>
  );
}
function ServiceEditor({
  service,
  data,
  catalog,
  pending,
  onSubmit,
  onCancel,
}: {
  service: Service | null;
  data: AdminData;
  catalog: CatalogData;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [duration, setDuration] = useState(service?.durationMinutes ?? 60);
  const [price, setPrice] = useState(service?.priceMnt ?? 0);
  const title = service ? "Үйлчилгээ засах" : "Шинэ үйлчилгээ";
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus({
      preventScroll: true,
    });
  }, []);
  return (
    <section
      ref={ref}
      className="panel service-editor"
      aria-labelledby="service-editor-title"
    >
      <h2 id="service-editor-title">{title}</h2>
      <form
        onSubmit={onSubmit}
        onInvalidCapture={localizeInvalidField}
        onInputCapture={clearFieldValidity}
      >
        <div className="form-grid">
          <label className="field">
            Үйлчилгээний нэр
            <input
              name="name"
              required
              maxLength={150}
              defaultValue={service?.name}
              placeholder="Жишээ: Гелэн маникюр"
            />
          </label>
          <label className="field">
            Ангилал
            <select
              name="categoryId"
              required
              defaultValue={service?.categoryId ?? ""}
            >
              <option value="">Ангилал сонгох</option>
              {catalog.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.active && " · Идэвхгүй"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!catalog.categories.length && (
          <div className="notice">
            Эхлээд «Ангилал нэмэх» товчоор ангиллаа үүсгэнэ үү.
          </div>
        )}
        <label className="field">
          Тайлбар
          <textarea
            name="description"
            maxLength={2000}
            defaultValue={service?.description ?? ""}
            placeholder="Үйлчилгээний тухай товч мэдээлэл"
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Үнэ · ₮
            <input
              type="number"
              name="priceMnt"
              min={0}
              max={1000000000}
              step={1}
              required
              defaultValue={service?.priceMnt ?? 0}
              onChange={(e) => setPrice(Number(e.target.value) || 0)}
            />
          </label>
          <div className="field-with-hint">
            <label className="field">
              Хугацаа · минут
              <input
                name="durationMinutes"
                type="number"
                min={1}
                max={1440}
                step={1}
                required
                aria-describedby="service-duration-hint"
                defaultValue={service?.durationMinutes ?? 60}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            <small id="service-duration-hint">
              {duration > 0
                ? formatDuration(duration)
                : "Хугацаагаа оруулна уу"}
            </small>
          </div>
        </div>
        <DiscountField price={price} initial={service?.discountPercent ?? 0} />
        <fieldset>
          <legend>Үйлчилгээ үзүүлэх салбарууд</legend>
          <div className="choice-chips">
            {data.branches.map((b) => (
              <label className="check-field" key={b.id}>
                <input
                  type="checkbox"
                  name="branches"
                  value={b.id}
                  defaultChecked={
                    service
                      ? service.branchIds.includes(b.id)
                      : data.branches.length === 1
                  }
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
        <div className="service-editor-options">
          <label className="check-field">
            <input
              type="checkbox"
              name="onlineBookable"
              defaultChecked={service?.onlineBookable ?? false}
            />
            Онлайнаар захиалахыг зөвшөөрөх
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              name="active"
              defaultChecked={service?.active ?? true}
            />
            Идэвхтэй
          </label>
        </div>
        <p className="field-hint">
          Онлайнаар зөвшөөрсөн, идэвхтэй үйлчилгээ салоны цахим захиалгын
          хуудсанд харагдана.
        </p>
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onCancel}>
            Цуцлах
          </Button>
          <Button
            disabled={
              pending ||
              data.preview ||
              !catalog.categories.length ||
              !data.branches.length
            }
          >
            {pending ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </div>
      </form>
    </section>
  );
}
function PriceTag({ price, discount }: { price: number; discount: number }) {
  if (!discount) return <b>{formatMnt(price)}</b>;
  return (
    <>
      <s className="price-was">{formatMnt(price)}</s>{" "}
      <b className="sale-text">{formatMnt(discountedPrice(price, discount))}</b>
    </>
  );
}
function DiscountField({ price, initial }: { price: number; initial: number }) {
  const [enabled, setEnabled] = useState(initial > 0);
  const [percent, setPercent] = useState(initial || 20);
  const valid =
    Number.isInteger(percent) &&
    percent >= 1 &&
    percent <= MAX_DISCOUNT_PERCENT;
  return (
    <section
      className={`discount-box ${enabled ? "is-on" : ""}`}
      aria-labelledby="discount-title"
    >
      <input
        type="hidden"
        name="discountPercent"
        value={enabled && valid ? percent : 0}
      />
      <label className="check-field discount-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <Flame size={15} aria-hidden="true" />
        <strong id="discount-title">Хямдралтай болгох</strong>
        <span>Хуучин үнэ нь зураастай харагдана</span>
      </label>
      {enabled && (
        <>
          <p className="discount-question">Хэдэн хувиар хямдруулах вэ?</p>
          <div className="discount-options">
            {DISCOUNT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={percent === p}
                onClick={() => setPercent(p)}
              >
                {p}%
              </button>
            ))}
            <span className="discount-or">эсвэл</span>
            <label className="discount-custom">
              <input
                type="number"
                min={1}
                max={MAX_DISCOUNT_PERCENT}
                step={1}
                required
                aria-label="Хямдралын хувь"
                value={Number.isNaN(percent) ? "" : percent}
                onChange={(e) => setPercent(e.target.valueAsNumber)}
              />
              %
            </label>
          </div>
          <div className="discount-preview" aria-live="polite">
            <span>Үйлчлүүлэгчид харагдах үнэ:</span>
            {valid ? (
              <>
                <s className="price-was">{formatMnt(price)}</s>
                <strong className="sale-text">
                  {formatMnt(discountedPrice(price, percent))}
                </strong>
              </>
            ) : (
              <strong>1–{MAX_DISCOUNT_PERCENT}% хооронд оруулна уу</strong>
            )}
          </div>
          <p className="field-hint">
            Хямдарсан үнийг ойролцоох 100₮ рүү дугуйлж тооцно. Шинэ захиалгад
            хямдарсан үнэ бичигдэнэ, өмнөх захиалгын үнэ өөрчлөгдөхгүй.
          </p>
        </>
      )}
    </section>
  );
}
