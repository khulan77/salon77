"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, UserRound, Pencil } from "lucide-react";
import type { AdminData } from "@/lib/admin-data";
import type { StaffData } from "@/lib/services/staff";
import type { CatalogData } from "@/lib/services/catalog";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { Button } from "./ui/button";
export function StaffDirectory({
  data,
  staff,
  catalog,
}: {
  data: AdminData;
  staff: StaffData;
  catalog: CatalogData;
}) {
  const router = useRouter(),
    owner = data.role === "SALON_OWNER";
  const [editing, setEditing] = useState<StaffData[number] | "new" | null>(
      null,
    ),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [branch, setBranch] = useState("all");
  const current = editing && editing !== "new" ? editing : null;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
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
    try {
      await requestJson(
        `/api/staff${current ? `?id=${current.id}` : ""}`,
        current ? "PATCH" : "POST",
        {
          name: f.get("name"),
          title: f.get("title"),
          phone: f.get("phone"),
          bio: f.get("bio"),
          active,
          memberId: f.get("memberId") || null,
          branchIds: f.getAll("branches"),
          serviceIds: f.getAll("services"),
        },
      );
      setEditing(null);
      setMessage("Ажилтны мэдээллийг хадгаллаа.");
      router.refresh();
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
  const visible = staff.filter(
    (s) => branch === "all" || s.branchIds.includes(branch),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ҮЙЛ АЖИЛЛАГАА</div>
          <h1>
            Ажилтнууд<span className="heading-dot">.</span>
          </h1>
          <p>Ажилтнуудаа салбар, үйлчилгээнд хуваарилаарай.</p>
        </div>
        {owner && (
          <Button
            onClick={() => {
              setError("");
              setEditing("new");
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
      <div className="feature-toolbar">
        <label className="field">
          Салбараар шүүх
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="all">Бүх салбар</option>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {visible.length ? (
        <div className="branch-grid">
          {visible.map((s) => (
            <article className="panel branch-card" key={s.id}>
              <div className="branch-card-heading">
                <UserRound size={19} />
                <h2>{s.name}</h2>
                <span className={`status-pill ${s.active ? "" : "inactive"}`}>
                  {s.active ? "Идэвхтэй" : "Идэвхгүй"}
                </span>
              </div>
              <p>{s.title}</p>
              <p>
                {data.branches
                  .filter((b) => s.branchIds.includes(b.id))
                  .map((b) => b.name)
                  .join(", ")}
              </p>
              {s.phone && <p>{s.phone}</p>}
              {s.bio && <p>{s.bio}</p>}
              <p>{s.serviceIds.length} үйлчилгээ</p>
              <p>
                {catalog.services
                  .filter((v) => s.serviceIds.includes(v.id))
                  .map((v) => v.name)
                  .join(", ")}
              </p>
              <div className="branch-card-footer">
                {owner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError("");
                      setEditing(s);
                    }}
                  >
                    <Pencil size={13} />
                    Засах
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/schedules?staffId=${s.id}`}>Ажлын хуваарь</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <UserRound size={27} />
          </div>
          <h2>
            {staff.length
              ? "Тохирох ажилтан алга"
              : "Та одоогоор ажилтан нэмээгүй байна."}
          </h2>
          <p>Ажилтан бүртгэхэд заавал нэвтрэх эрх үүсгэх шаардлагагүй.</p>
          {owner && (
            <Button onClick={() => setEditing("new")}>Ажилтан нэмэх</Button>
          )}
        </section>
      )}
      <FeatureDialog
        open={!!editing}
        title={current ? "Ажилтан засах" : "Ажилтан нэмэх"}
        onClose={() => setEditing(null)}
      >
        <Feedback error={error} />
        <form
          onSubmit={submit}
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearFieldValidity}
        >
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
            Албан тушаал
            <input
              name="title"
              required
              maxLength={100}
              defaultValue={current?.title}
              placeholder="Жишээ: Хумсны мастер"
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
          <label className="field">
            Товч танилцуулга
            <textarea name="bio" maxLength={2000} defaultValue={current?.bio} />
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
            Холбосон гишүүний салбарын эрх болон ажилтны салбарын хуваарилалт
            давхцсан үед өөрийн хуваарийг харна.
          </p>
          <fieldset>
            <legend>Ажиллах салбарууд</legend>
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
          <fieldset>
            <legend>Үзүүлэх үйлчилгээнүүд</legend>
            {catalog.services.map((s) => (
              <label className="check-field" key={s.id}>
                <input
                  type="checkbox"
                  name="services"
                  value={s.id}
                  defaultChecked={current?.serviceIds.includes(s.id)}
                />
                {s.name}
                {!s.active && " · Идэвхгүй"}
              </label>
            ))}
            {!catalog.services.length && (
              <Link href="/services">Үйлчилгээ нэмэх</Link>
            )}
          </fieldset>
          <label className="check-field">
            <input
              type="checkbox"
              name="active"
              defaultChecked={current?.active ?? true}
            />
            Идэвхтэй
          </label>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Цуцлах
            </Button>
            <Button disabled={pending || data.preview || !data.branches.length}>
              {pending ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </div>
        </form>
      </FeatureDialog>
    </>
  );
}
