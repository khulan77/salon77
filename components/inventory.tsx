"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Boxes, Minus, Pencil, Plus, Search } from "lucide-react";
import type { AdminData } from "@/lib/admin-data";
import type { InventoryData } from "@/lib/services/inventory";
import { productUnits } from "@/lib/inventory-validation";
import { requestJson } from "@/lib/client-request";
import { formatMnt, userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { Button } from "./ui/button";
import { PhotoField } from "./photo-field";
import { tone } from "@/lib/avatar";
type Product = InventoryData[number];
export function Inventory({
  data,
  products,
}: {
  data: AdminData;
  products: InventoryData;
}) {
  const router = useRouter(),
    canEdit = ["SALON_OWNER", "MANAGER"].includes(data.role) && !data.preview,
    branches = data.branches.filter((b) => b.active);
  const [branch, setBranch] = useState(
      branches.length > 1 ? "all" : (branches[0]?.id ?? "all"),
    ),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [lowOnly, setLowOnly] = useState(false),
    [editing, setEditing] = useState<Product | "new" | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<string | null>(null);
  const qty = (p: Product) =>
    branch === "all"
      ? Object.values(p.stock).reduce((sum, q) => sum + q, 0)
      : (p.stock[branch] ?? 0);
  // Low stock is judged per branch: any branch at or under the threshold.
  const low = (p: Product) =>
    p.lowStock > 0 &&
    (branch === "all"
      ? branches.some((b) => (p.stock[b.id] ?? 0) <= p.lowStock)
      : qty(p) <= p.lowStock);
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products],
  );
  const visible = products.filter(
    (p) =>
      (!category || p.category === category) &&
      (!lowOnly || (p.active && low(p))) &&
      (!query.trim() ||
        `${p.name} ${p.sku}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())),
  );
  const active = products.filter((p) => p.active),
    stockValue = active.reduce(
      (sum, p) => sum + (p.costMnt ?? p.priceMnt) * qty(p),
      0,
    ),
    lowCount = active.filter(low).length;
  async function adjust(p: Product, delta: number) {
    setPending(p.id);
    setError("");
    try {
      await requestJson("/api/products/stock", "POST", {
        productId: p.id,
        branchId: branch,
        delta,
      });
      setMessage("");
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Үлдэгдлийг өөрчилж чадсангүй."));
    } finally {
      setPending(null);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ҮЙЛ АЖИЛЛАГАА</div>
          <h1>
            Бараа бүртгэл<span className="heading-dot">.</span>
          </h1>
          <p>Зарах болон хэрэглээний бараа, салбар бүрийн үлдэгдэл.</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setError("");
              setEditing("new");
            }}
          >
            <Plus size={14} />
            Бараа нэмэх
          </Button>
        )}
      </div>
      {data.preview && (
        <div className="notice">
          Та танилцах горимд байна. Бараа хадгалахын тулд салоноо бүртгэнэ үү.
        </div>
      )}
      {!editing && <Feedback error={error} message={message} />}
      <div className="calendar-stats inventory-stats">
        {branches.length > 1 && (
          <div className="branch-tabs" role="tablist" aria-label="Салбар">
            {[{ id: "all", name: "Бүх салбар" }, ...branches].map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={branch === b.id}
                onClick={() => setBranch(b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
        <dl>
          <div>
            <dt>Бараа</dt>
            <dd>{active.length}</dd>
          </div>
          <div>
            <dt>Нөөцийн үнэ</dt>
            <dd>{formatMnt(stockValue)}</dd>
          </div>
          <div>
            <dt>Дуусах дөхсөн</dt>
            <dd className={lowCount ? "warn" : ""}>{lowCount}</dd>
          </div>
        </dl>
      </div>
      <div className="inventory-toolbar">
        <label className="quick-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            aria-label="Бараа хайх"
            placeholder="Нэр эсвэл кодоор хайх…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="chip-row" role="group" aria-label="Ангилал">
          {["", ...categories].map((c) => (
            <button
              key={c || "all"}
              type="button"
              className="chip"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c || "Бүгд"}
            </button>
          ))}
          <button
            type="button"
            className="chip"
            aria-pressed={lowOnly}
            onClick={() => setLowOnly(!lowOnly)}
          >
            Дуусах дөхсөн
          </button>
        </div>
      </div>
      {visible.length ? (
        <ul className="panel product-list" aria-label="Бараанууд">
          {visible.map((p) => {
            const count = qty(p),
              state = !p.active
                ? "off"
                : count === 0
                  ? "out"
                  : low(p)
                    ? "low"
                    : "ok";
            return (
              <li key={p.id} className={`product-row is-${state}`}>
                <span className={`product-thumb tone-${tone(p.id)}`}>
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="52px"
                    />
                  ) : (
                    (p.name.trim()[0] ?? "?").toUpperCase()
                  )}
                </span>
                <span className="product-main">
                  <strong>{p.name}</strong>
                  <small>
                    {p.sku || "Кодгүй"}
                    {p.category && <em>{p.category}</em>}
                  </small>
                </span>
                <span className="product-prices">
                  <b>{formatMnt(p.priceMnt)}</b>
                  {p.costMnt !== null && (
                    <small>Өртөг {formatMnt(p.costMnt)}</small>
                  )}
                </span>
                <span className="product-stock">
                  {canEdit && branch !== "all" && p.active && (
                    <button
                      type="button"
                      aria-label={`${p.name} · 1 хасах`}
                      disabled={pending === p.id || count === 0}
                      onClick={() => adjust(p, -1)}
                    >
                      <Minus size={14} />
                    </button>
                  )}
                  <span className="product-count">
                    <b>
                      {count} {p.unit}
                    </b>
                    <small>
                      {
                        {
                          ok: "Хангалттай",
                          low: "Дуусах дөхсөн",
                          out: "Дууссан",
                          off: "Идэвхгүй",
                        }[state]
                      }
                    </small>
                  </span>
                  {canEdit && branch !== "all" && p.active && (
                    <button
                      type="button"
                      aria-label={`${p.name} · 1 нэмэх`}
                      disabled={pending === p.id}
                      onClick={() => adjust(p, 1)}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    className="product-edit"
                    aria-label={`${p.name} засах`}
                    onClick={() => {
                      setError("");
                      setEditing(p);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <Boxes size={27} />
          </div>
          <h2>
            {products.length
              ? "Тохирох бараа алга"
              : "Та одоогоор бараа бүртгээгүй байна."}
          </h2>
          <p>
            Шампунь, будаг, хумсны лак гэх мэт зарах болон хэрэглээний бараагаа
            бүртгээд үлдэгдлээ хянаарай.
          </p>
          {canEdit && !products.length && (
            <Button onClick={() => setEditing("new")}>Бараа нэмэх</Button>
          )}
        </section>
      )}
      {branch === "all" && branches.length > 1 && canEdit && (
        <p className="field-hint">
          Үлдэгдлийг +/− товчоор өөрчлөхийн тулд дээрээс салбараа сонгоно уу.
        </p>
      )}
      <FeatureDialog
        open={!!editing}
        wide
        title={editing && editing !== "new" ? "Бараа засах" : "Бараа нэмэх"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <ProductForm
            product={editing === "new" ? null : editing}
            data={data}
            categories={categories}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setMessage("Барааг хадгаллаа.");
              router.refresh();
            }}
          />
        )}
      </FeatureDialog>
    </>
  );
}
function ProductForm({
  product,
  data,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  data: AdminData;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Managers only edit stock in their own branches; data.branches is already scoped.
  const branches = data.branches.filter((b) => b.active);
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [photo, setPhoto] = useState(product?.imageUrl ?? null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (key: string) => Number(f.get(key) || 0);
    setPending(true);
    setError("");
    try {
      await requestJson(
        `/api/products${product ? `?id=${product.id}` : ""}`,
        product ? "PATCH" : "POST",
        {
          name: f.get("name"),
          sku: f.get("sku") ?? "",
          category: f.get("category") ?? "",
          unit: f.get("unit"),
          costMnt: num("costMnt"),
          priceMnt: num("priceMnt"),
          lowStock: num("lowStock"),
          active: f.get("active") === "on",
          stock: branches.map((b) => ({
            branchId: b.id,
            quantity: num(`stock-${b.id}`),
          })),
        },
      );
      onSaved();
    } catch (e) {
      setError(userFacingError(e, "Барааг хадгалж чадсангүй."));
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
          {!data.preview && data.role === "SALON_OWNER" && (
            <PhotoField
              target="product"
              id={product?.id ?? null}
              url={photo}
              onChange={(url) => {
                setPhoto(url);
                router.refresh();
              }}
            />
          )}
          <label className="field">
            Барааны нэр
            <input
              name="name"
              required
              maxLength={150}
              defaultValue={product?.name}
              placeholder="Жишээ: Гель лак №12"
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Код / баркод · заавал биш
              <input name="sku" maxLength={64} defaultValue={product?.sku} />
            </label>
            <label className="field">
              Ангилал
              <input
                name="category"
                maxLength={60}
                list="product-categories"
                defaultValue={product?.category}
                placeholder="Жишээ: Хумс"
              />
              <datalist id="product-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="form-grid inventory-prices">
            <label className="field">
              Өртөг үнэ · ₮
              <input
                name="costMnt"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={product?.costMnt ?? ""}
              />
            </label>
            <label className="field">
              Зарах үнэ · ₮
              <input
                name="priceMnt"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={product?.priceMnt ?? ""}
              />
            </label>
            <label className="field">
              Хэмжих нэгж
              <select name="unit" defaultValue={product?.unit ?? "ш"}>
                {productUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Доод үлдэгдэл
              <input
                name="lowStock"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={product?.lowStock ?? 0}
              />
            </label>
          </div>
          <p className="field-hint">
            Үлдэгдэл «Доод үлдэгдэл»-ээс бага болоход «Дуусах дөхсөн» гэж
            анхааруулна. 0 бол анхааруулахгүй.
          </p>
          {branches.length > 0 && (
            <section className="quick-section">
              <h3>Үлдэгдэл</h3>
              <div className="form-grid">
                {branches.map((b) => (
                  <label className="field" key={b.id}>
                    {b.name}
                    <input
                      name={`stock-${b.id}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      defaultValue={product?.stock[b.id] ?? 0}
                    />
                  </label>
                ))}
              </div>
            </section>
          )}
          <label className="check-field">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
            />
            Идэвхтэй
          </label>
        </div>
        <div className="quick-footer">
          <p>{product ? product.name : "Шинэ бараа"}</p>
          <Button type="button" variant="outline" onClick={onClose}>
            Цуцлах
          </Button>
          <Button disabled={pending}>
            {pending ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </div>
      </form>
    </div>
  );
}
