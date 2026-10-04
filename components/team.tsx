"use client";
import { userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Users, X, ShieldCheck, ArrowRight } from "lucide-react";
import { roleLabel } from "@/lib/ui-language";
import { Button } from "./ui/button";
import type { AdminData } from "@/lib/admin-data";
export function Team({ data }: { data: AdminData }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const result = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          role: form.get("role"),
          branchIds: form.getAll("branches"),
        }),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      setMessage(body.message);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Урилгыг хадгалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">БАГ</div>
          <h1>
            Хамтдаа илүү бүтээе<span className="heading-dot">.</span>
          </h1>
          <p>Багийн гишүүд болон тэдний эрхийг нэг дороос удирдаарай.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} /> Гишүүн урих
        </Button>
      </div>
      <div className="notice">
        <ShieldCheck
          size={15}
          style={{ display: "inline", verticalAlign: "middle", marginRight: 7 }}
        />
        Урилгыг ноорог хэлбэрээр хадгална. Имэйл илгээх, урилга хүлээн авах
        боломж дараагийн шатанд нэмэгдэнэ. Ноорог хадгалснаар нэвтрэх эрх
        үүсэхгүй.
      </div>
      {message && (
        <div className="success-message" role="status">
          {message}
        </div>
      )}
      {data.members.length ? (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Гишүүн</th>
                <th>Эрх</th>
                <th>Хариуцах салбарууд</th>
                <th>Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </td>
                  <td>
                    <span className="role-badge">{roleLabel(m.role)}</span>
                  </td>
                  <td>
                    {m.role === "SALON_OWNER"
                      ? "Бүх салбар"
                      : m.branches.join(", ") || "Байхгүй"}
                  </td>
                  <td>
                    <span className="status-pill">Идэвхтэй</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <Users size={28} strokeWidth={1.4} />
          </div>
          <h2>Багаа бүрдүүлээрэй</h2>
          <p>
            Багийн гишүүд энд харагдана.
            <br />
            Салоноо үүсгээд хамт олноо нэгтгээрэй.
          </p>
          <Button asChild>
            <Link href="/onboarding">
              Салоноо тохируулах <ArrowRight size={14} />
            </Link>
          </Button>
        </section>
      )}
      {data.invitations.length > 0 && (
        <section className="panel table-wrap" style={{ marginTop: 25 }}>
          <div className="panel-heading">
            <h2>Урилгын нооргууд</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Нэр</th>
                <th>Эрх</th>
                <th>Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {data.invitations.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.name}</strong>
                    <small>{i.email}</small>
                  </td>
                  <td>{roleLabel(i.role)}</td>
                  <td>
                    {new Date(i.expiresAt) < new Date()
                      ? "Хугацаа дууссан"
                      : "Ноорог · илгээгээгүй"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <dialog
        ref={dialog}
        className="native-dialog"
        onCancel={() => setOpen(false)}
      >
        <div className="form-dialog">
          <div className="form-dialog-header">
            <h2>Багийн гишүүн урих</h2>
            <button
              className="icon-button"
              onClick={() => setOpen(false)}
              aria-label="Урилгын цонх хаах"
            >
              <X size={18} />
            </button>
          </div>
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <form
            onInvalidCapture={localizeInvalidField}
            onInputCapture={clearFieldValidity}
            onSubmit={submit}
          >
            <label className="field">
              Овог, нэр
              <input
                name="name"
                required
                maxLength={100}
                placeholder="Гишүүний овог, нэр"
              />
            </label>
            <label className="field">
              Имэйл
              <input
                name="email"
                type="email"
                required
                placeholder="name@example.com"
              />
            </label>
            <label className="field">
              Эрх
              <select name="role">
                <option value="MANAGER">Менежер</option>
                <option value="RECEPTIONIST">Угтах ажилтан</option>
                <option value="STAFF">Ажилтан</option>
              </select>
              <small>
                Эрхэд тохирсон боломжууд нээгдэхэд зөвхөн хариуцах салбартаа
                хандах эрхтэй болно.
              </small>
            </label>
            <fieldset>
              <legend>Хариуцах салбарууд</legend>
              {data.branches
                .filter((b) => b.active)
                .map((b) => (
                  <label key={b.id} className="check-field">
                    <input type="checkbox" name="branches" value={b.id} />
                    {b.name}
                  </label>
                ))}
              {!data.branches.some((b) => b.active) && (
                <p style={{ color: "#a28cb1", fontSize: 11 }}>
                  Урилга үүсгэхээсээ өмнө идэвхтэй салбар нэмнэ үү.
                </p>
              )}
            </fieldset>
            <div className="notice" style={{ marginTop: 18 }}>
              Урилга ноорог хэлбэрээр хадгалагдана. Имэйл илгээхгүй, нэвтрэх эрх
              үүсэхгүй.
            </div>
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Цуцлах
              </Button>
              <Button
                disabled={
                  pending ||
                  data.preview ||
                  !data.branches.some((b) => b.active)
                }
              >
                {pending ? "Хадгалж байна…" : "Ноорог хадгалах"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
