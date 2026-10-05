"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Scissors, Pencil, Clock3, MapPin } from "lucide-react";
import type { AdminData } from "@/lib/admin-data";
import type { CatalogData } from "@/lib/services/catalog";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
type Service = CatalogData["services"][number];
type Category = CatalogData["categories"][number];
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
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const active = form.get("active") === "on";
      if (
        (current?.active || currentCategory?.active) &&
        !active &&
        !window.confirm("Идэвхгүй болгох уу? Өмнөх мэдээлэл хадгалагдана.")
      ) {
        setPending(false);
        return;
      }
      if (category)
        await requestJson(
          `/api/categories${currentCategory ? `?id=${currentCategory.id}` : ""}`,
          currentCategory ? "PATCH" : "POST",
          {
            name: form.get("name"),
            sortOrder: Number(form.get("sortOrder")),
            active,
          },
        );
      else
        await requestJson(
          `/api/services${current ? `?id=${current.id}` : ""}`,
          current ? "PATCH" : "POST",
          {
            name: form.get("name"),
            categoryId: form.get("categoryId"),
            description: form.get("description"),
            priceMnt: Number(form.get("priceMnt")),
            durationMinutes: Number(form.get("durationMinutes")),
            onlineBookable: form.get("onlineBookable") === "on",
            active,
            branchIds: form.getAll("branches"),
          },
        );
      setCategory(null);
      setService(null);
      setMessage("Мэдээллийг хадгаллаа.");
      router.refresh();
    } catch (e) {
      setError(
        userFacingError(e, "Үйлчилгээг хадгалж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setPending(false);
    }
  }
  const visible = catalog.services.filter(
    (s) =>
      (filter === "all" || s.categoryId === filter) &&
      (branch === "all" || s.branchIds.includes(branch)),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ҮЙЛ АЖИЛЛАГАА</div>
          <h1>
            Үйлчилгээнүүд<span className="heading-dot">.</span>
          </h1>
          <p>Үнэ, хугацаа болон үйлчилгээ үзүүлэх салбаруудаа тохируулаарай.</p>
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
            <Button
              onClick={() => {
                setError("");
                setService("new");
              }}
            >
              <Plus size={14} />
              Үйлчилгээ нэмэх
            </Button>
          </div>
        )}
      </div>
      {data.preview && (
        <div className="notice">
          Та танилцах горимд байна. Үйлчилгээ хадгалахын тулд салоноо бүртгэнэ
          үү.
        </div>
      )}
      {!service && !category && <Feedback error={error} message={message} />}
      <div className="feature-toolbar">
        <label className="field">
          Ангиллаар шүүх
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Бүх ангилал</option>
            {catalog.categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
                {c.active ? "" : " · Идэвхгүй"}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Салбараар шүүх
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="all">Бүх салбар</option>
            {data.branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {owner && catalog.categories.length > 0 && (
        <div className="category-list">
          {catalog.categories.map((c) => (
            <Button
              key={c.id}
              variant="outline"
              size="sm"
              onClick={() => {
                setError("");
                setCategory(c);
              }}
            >
              <Pencil size={12} />
              {c.name}
              {!c.active && " · Идэвхгүй"}
            </Button>
          ))}
        </div>
      )}
      {visible.length ? (
        <div className="branch-grid">
          {visible.map((s) => (
            <article className="panel branch-card" key={s.id}>
              <div className="branch-card-heading">
                <Scissors size={19} />
                <h2>{s.name}</h2>
                <span className={`status-pill ${s.active ? "" : "inactive"}`}>
                  {s.active ? "Идэвхтэй" : "Идэвхгүй"}
                </span>
              </div>
              <p>
                {catalog.categories.find((c) => c.id === s.categoryId)?.name}
              </p>
              <div className="service-price">
                {s.priceMnt.toLocaleString("en-US")}₮{" "}
                <span>
                  <Clock3 size={13} />
                  {s.durationMinutes} мин
                </span>
              </div>
              {s.description && <p>{s.description}</p>}
              <p>
                <MapPin size={12} style={{ display: "inline" }} />{" "}
                {data.branches
                  .filter((b) => s.branchIds.includes(b.id))
                  .map((b) => b.name)
                  .join(", ")}
              </p>
              <p>
                Цахим захиалга:{" "}
                {s.onlineBookable
                  ? "Зөвшөөрсөн · Дараагийн шатанд"
                  : "Хаалттай"}
              </p>
              {owner && (
                <div className="branch-card-footer">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError("");
                      setService(s);
                    }}
                  >
                    <Pencil size={13} />
                    Засах
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
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
          {owner && (
            <Button onClick={() => setService("new")}>
              <Plus size={14} />
              Үйлчилгээ нэмэх
            </Button>
          )}
        </section>
      )}
      <FeatureDialog
        open={!!service || !!category}
        title={
          category
            ? currentCategory
              ? "Ангилал засах"
              : "Ангилал нэмэх"
            : current
              ? "Үйлчилгээ засах"
              : "Үйлчилгээ нэмэх"
        }
        onClose={() => {
          setService(null);
          setCategory(null);
        }}
      >
        <Feedback error={error} />
        <form
          onSubmit={submit}
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearFieldValidity}
        >
          <label className="field">
            {category ? "Ангиллын нэр" : "Үйлчилгээний нэр"}
            <input
              name="name"
              required
              maxLength={category ? 100 : 150}
              defaultValue={currentCategory?.name ?? current?.name}
              placeholder={category ? "Жишээ: Хумс" : "Жишээ: Гелэн маникюр"}
            />
          </label>
          {category ? (
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
          ) : (
            <>
              <label className="field">
                Ангилал
                <select
                  name="categoryId"
                  required
                  defaultValue={current?.categoryId ?? ""}
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
                  defaultValue={current?.description ?? ""}
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
                    defaultValue={current?.priceMnt ?? 0}
                  />
                </label>
                <label className="field">
                  Хугацаа · минут
                  <input
                    name="durationMinutes"
                    type="number"
                    min={1}
                    max={1440}
                    step={1}
                    required
                    defaultValue={current?.durationMinutes ?? 60}
                  />
                </label>
              </div>
              <fieldset>
                <legend>Үйлчилгээ үзүүлэх салбарууд</legend>
                {data.branches.map((b) => (
                  <label className="check-field" key={b.id}>
                    <input
                      type="checkbox"
                      name="branches"
                      value={b.id}
                      defaultChecked={current?.branchIds.includes(b.id)}
                    />
                    {b.name}
                    {!b.active && " · Идэвхгүй"}
                  </label>
                ))}
                {!data.branches.length && (
                  <Link href="/branches">Эхлээд салбар нэмнэ үү.</Link>
                )}
              </fieldset>
              <label className="check-field">
                <input
                  type="checkbox"
                  name="onlineBookable"
                  defaultChecked={current?.onlineBookable ?? false}
                />
                Онлайнаар захиалахыг зөвшөөрөх
              </label>
              <p className="field-hint">
                Энэ нь ирээдүйн захиалгын тохиргоо. Одоогоор цахим захиалга
                нээгдээгүй.
              </p>
            </>
          )}
          <label className="check-field">
            <input
              type="checkbox"
              name="active"
              defaultChecked={
                currentCategory?.active ?? current?.active ?? true
              }
            />
            Идэвхтэй
          </label>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setService(null);
                setCategory(null);
              }}
            >
              Цуцлах
            </Button>
            <Button
              disabled={
                pending ||
                data.preview ||
                (!category &&
                  (!catalog.categories.length || !data.branches.length))
              }
            >
              {pending ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </div>
        </form>
      </FeatureDialog>
    </>
  );
}
