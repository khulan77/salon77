"use client";
import { userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Plus, Pencil, Power, X, ArrowRight } from "lucide-react";
import type { AdminData, BranchView } from "@/lib/admin-data";
import { Button } from "./ui/button";
export function Branches({ data }: { data: AdminData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BranchView | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (editing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editing]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const input = {
      name: form.get("name"),
      district: form.get("district"),
      address: form.get("address"),
      phone: form.get("phone"),
      latitude: form.get("latitude") ? Number(form.get("latitude")) : null,
      longitude: form.get("longitude") ? Number(form.get("longitude")) : null,
      active: editing !== "new" && editing ? editing.active : true,
    };
    try {
      const result = await fetch(
        `/api/branches${editing !== "new" && editing ? `?id=${editing.id}` : ""}`,
        {
          method: editing === "new" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      setEditing(null);
      setMessage("Салбарын мэдээллийг хадгаллаа.");
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Салбарын мэдээллийг хадгалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  async function toggle(branch: BranchView) {
    if (
      !window.confirm(
        `«${branch.name}» салбарыг ${branch.active ? "идэвхгүй болгох" : "идэвхжүүлэх"} уу? ${branch.active ? "Бүртгэл, мэдээлэл нь хадгалагдана." : ""}`,
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      const { name, district, address, phone, latitude, longitude } = branch;
      const result = await fetch(`/api/branches?id=${branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          district,
          address,
          phone,
          latitude,
          longitude,
          active: !branch.active,
        }),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      setMessage(
        branch.active
          ? "Салбарыг идэвхгүй болголоо."
          : "Салбарыг идэвхжүүллээ.",
      );
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Салбарын мэдээллийг шинэчилж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  const values = editing && editing !== "new" ? editing : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">МИНИЙ САЛОН</div>
          <h1>
            Бүх салбар нэг дор<span className="heading-dot">.</span>
          </h1>
          <p>Салбаруудынхаа мэдээллийг нэг дороос удирдаарай.</p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setEditing("new");
          }}
        >
          <Plus size={15} /> Салбар нэмэх
        </Button>
      </div>
      {data.preview && (
        <div className="notice">
          Та танилцах горимд байна. <Link href="/sign-up">Бүртгүүлэх</Link>{" "}
          холбоосоор бүртгүүлж, системийн холболтыг тохируулснаар салбараа
          хадгалах боломжтой.
        </div>
      )}
      {message && (
        <div className="success-message" role="status">
          {message}
        </div>
      )}
      {error && !editing && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {data.branches.length ? (
        <div className="branch-grid">
          {data.branches.map((branch) => (
            <article className="panel branch-card" key={branch.id}>
              <div className="branch-card-heading">
                <MapPin size={20} />
                <h2>{branch.name}</h2>
                <span
                  className={`status-pill ${branch.active ? "" : "inactive"}`}
                >
                  {branch.active ? "Идэвхтэй" : "Идэвхгүй"}
                </span>
              </div>
              <p>
                <strong>{branch.district}</strong>
                <br />
                {branch.address}
                <br />
                {branch.phone}
              </p>
              {branch.latitude !== null && (
                <p>
                  {branch.latitude}, {branch.longitude}
                </p>
              )}
              <div className="branch-card-footer">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError("");
                    setEditing(branch);
                  }}
                >
                  <Pencil size={13} /> Салбар засах
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => toggle(branch)}
                >
                  <Power size={13} />
                  {branch.active ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <MapPin size={27} strokeWidth={1.3} />
          </div>
          <h2>Эхний салбараа бүртгээрэй</h2>
          <p>
            Та одоогоор салбар нэмээгүй байна.
            <br />
            Салбарынхаа хаяг, байршлыг нэмээрэй.
          </p>
          <Button onClick={() => setEditing("new")}>
            <Plus size={14} /> Эхний салбараа нэмэх
          </Button>
        </section>
      )}
      <dialog
        ref={dialog}
        className="native-dialog"
        onCancel={() => setEditing(null)}
      >
        <div className="form-dialog">
          <div className="form-dialog-header">
            <h2>{values ? "Салбар засах" : "Шинэ салбар нэмэх"}</h2>
            <button
              className="icon-button"
              aria-label="Маягт хаах"
              onClick={() => setEditing(null)}
            >
              <X size={18} />
            </button>
          </div>
          {error && (
            <div role="alert" className="error-message">
              {error}
            </div>
          )}
          <form
            onInvalidCapture={localizeInvalidField}
            onInputCapture={clearFieldValidity}
            onSubmit={save}
            key={values?.id ?? "new"}
          >
            <label className="field">
              Салбарын нэр
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={values?.name}
                placeholder="Жишээ: Зайсан салбар"
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Дүүрэг
                <input
                  name="district"
                  required
                  maxLength={100}
                  defaultValue={values?.district}
                  placeholder="Жишээ: Хан-Уул"
                />
              </label>
              <label className="field">
                Утасны дугаар
                <input
                  name="phone"
                  type="tel"
                  required
                  maxLength={30}
                  defaultValue={values?.phone}
                  placeholder="+976"
                />
              </label>
            </div>
            <label className="field">
              Хаяг
              <textarea
                name="address"
                required
                maxLength={500}
                defaultValue={values?.address}
                placeholder="Гудамж, байр, давхар"
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Өргөрөг · заавал биш
                <input
                  name="latitude"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  defaultValue={values?.latitude ?? ""}
                />
              </label>
              <label className="field">
                Уртраг · заавал биш
                <input
                  name="longitude"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  defaultValue={values?.longitude ?? ""}
                />
              </label>
            </div>
            {data.preview && (
              <div className="notice">
                Та танилцах горимд байна. Салбар нэмэхээсээ өмнө бүртгүүлж,
                салоноо үүсгэнэ үү.
              </div>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Цуцлах
              </Button>
              {data.preview ? (
                <Button asChild>
                  <Link href="/sign-up">
                    Бүртгүүлэх <ArrowRight size={14} />
                  </Link>
                </Button>
              ) : (
                <Button disabled={pending}>
                  {pending ? "Хадгалж байна…" : "Хадгалах"}
                </Button>
              )}
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
