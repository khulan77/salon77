"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Pencil, XCircle, Copy } from "lucide-react";
import type { AdminData } from "@/lib/admin-data";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { roleLabel, userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { requestJson } from "@/lib/client-request";
const statusLabels: Record<string, string> = {
  DRAFT: "Хуучин ноорог",
  PENDING: "Урилга хүлээгдэж байна",
  ACCEPTED: "Хүлээн авсан",
  EXPIRED: "Хугацаа дууссан",
  CANCELLED: "Цуцалсан",
};
export function Team({ data }: { data: AdminData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<
    AdminData["members"][number] | "invite" | null
  >(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const fields = {
      role: form.get("role"),
      branchIds: form.getAll("branches"),
    };
    try {
      if (editing === "invite") {
        const result = await requestJson<{
          invitePath: string;
          message: string;
        }>("/api/invitations", "POST", {
          ...fields,
          name: form.get("name"),
          email: form.get("email"),
        });
        setInviteLink(new URL(result.invitePath, window.location.origin).href);
        setMessage(result.message);
      } else if (editing) {
        const active = form.get("active") === "on";
        if (
          editing.active &&
          !active &&
          !window.confirm("Энэ гишүүний нэвтрэх эрхийг идэвхгүй болгох уу?")
        ) {
          setPending(false);
          return;
        }
        await requestJson(`/api/members?id=${editing.id}`, "PATCH", {
          ...fields,
          active,
        });
        setMessage("Гишүүний эрхийг хадгаллаа.");
      }
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Мэдээллийг хадгалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  async function cancel(id: string) {
    if (
      !window.confirm(
        "Энэ урилгыг цуцлах уу? Холбоосыг дахин ашиглах боломжгүй болно.",
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/invitations?id=${id}`, "PATCH");
      setMessage("Урилгыг цуцаллаа.");
      setInviteLink("");
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Урилгыг цуцалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  const member = editing && editing !== "invite" ? editing : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">БАГ</div>
          <h1>
            Баг ба эрхийн тохиргоо<span className="heading-dot">.</span>
          </h1>
          <p>Гишүүдийн эрх болон хариуцах салбаруудыг удирдаарай.</p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setEditing("invite");
          }}
        >
          <Plus size={15} />
          Гишүүн урих
        </Button>
      </div>
      <div className="notice">
        Имэйл илгээлт тохируулагдаагүй. Туршилтын холбоосыг зөвхөн эзэмшигч
        харна. Урилгыг зөвхөн уригдсан, баталгаажсан имэйлээр хүлээн авна.
      </div>
      {!editing && <Feedback error={error} message={message} />}
      {inviteLink && (
        <div className="notice">
          <strong>Туршилтын урилгын холбоос · Имэйл илгээгээгүй</strong>
          <p>Холбоосыг нэг удаа харуулна. Зөвхөн уригдсан хүнд дамжуулна уу.</p>
          <label className="field">
            Урилгын холбоос
            <input
              readOnly
              value={inviteLink}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteLink);
                setMessage("Холбоосыг хууллаа.");
              } catch {
                setError("Холбоосыг сонгоод гараар хуулна уу.");
              }
            }}
          >
            <Copy size={14} />
            Хуулах
          </Button>
        </div>
      )}
      {data.members.length ? (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Нэр</th>
                <th>Эрх</th>
                <th>Салбар</th>
                <th>Төлөв</th>
                <th>Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </td>
                  <td>{roleLabel(m.role)}</td>
                  <td>
                    {m.role === "SALON_OWNER"
                      ? "Бүх салбар"
                      : m.branches.join(", ") || "Байхгүй"}
                  </td>
                  <td>{m.active ? "Идэвхтэй" : "Идэвхгүй"}</td>
                  <td>
                    {m.role !== "SALON_OWNER" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setError("");
                          setEditing(m);
                        }}
                      >
                        <Pencil size={13} />
                        Эрх засах
                      </Button>
                    ) : (
                      <span className="role-badge">Хамгаалагдсан эрх</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <Users size={28} />
          </div>
          <h2>Багаа бүрдүүлээрэй</h2>
          <p>Гишүүдийн нэр, эрх болон хариуцах салбарууд энд харагдана.</p>
        </section>
      )}
      {data.invitations.length > 0 && (
        <section className="panel table-wrap" style={{ marginTop: 22 }}>
          <div className="panel-heading">
            <h2>Урилгууд</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Нэр</th>
                <th>Эрх</th>
                <th>Салбар</th>
                <th>Төлөв</th>
                <th>Үйлдэл</th>
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
                    {data.branches
                      .filter((b) => i.branchIds.includes(b.id))
                      .map((b) => b.name)
                      .join(", ")}
                  </td>
                  <td>{statusLabels[i.status] ?? "Хүчингүй"}</td>
                  <td>
                    {["DRAFT", "PENDING", "EXPIRED"].includes(i.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => cancel(i.id)}
                      >
                        <XCircle size={13} />
                        Цуцлах
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <FeatureDialog
        open={!!editing}
        title={member ? "Гишүүний эрх засах" : "Гишүүн урих"}
        onClose={() => setEditing(null)}
      >
        <Feedback error={error} />
        <form
          onSubmit={submit}
          onInvalidCapture={localizeInvalidField}
          onInputCapture={clearFieldValidity}
        >
          {!member && (
            <>
              <label className="field">
                Нэр
                <input
                  name="name"
                  required
                  maxLength={100}
                  placeholder="Овог, нэр"
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
            </>
          )}
          {member && (
            <p className="notice">
              {member.name} · {member.email}
            </p>
          )}
          <label className="field">
            Эрх
            <select name="role" defaultValue={member?.role ?? "RECEPTIONIST"}>
              <option value="MANAGER">Менежер</option>
              <option value="RECEPTIONIST">Ресепшн</option>
              <option value="STAFF">Ажилтан</option>
            </select>
          </label>
          <fieldset>
            <legend>Салбарын эрх</legend>
            {data.branches
              .filter((b) => b.active)
              .map((b) => (
                <label className="check-field" key={b.id}>
                  <input
                    type="checkbox"
                    name="branches"
                    value={b.id}
                    defaultChecked={member?.branchIds.includes(b.id)}
                  />
                  {b.name}
                </label>
              ))}
            {!data.branches.some((b) => b.active) && (
              <p>Эхлээд идэвхтэй салбар нэмнэ үү.</p>
            )}
          </fieldset>
          {member && (
            <label className="check-field">
              <input
                type="checkbox"
                name="active"
                defaultChecked={member.active}
              />
              Нэвтрэх эрх идэвхтэй
            </label>
          )}
          {data.preview && (
            <div className="notice" style={{ marginTop: 15 }}>
              Танилцах горимд урилга үүсгэх боломжгүй. Эхлээд салоноо бүртгэнэ
              үү.
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
            <Button
              disabled={
                pending || data.preview || !data.branches.some((b) => b.active)
              }
            >
              {pending
                ? "Хадгалж байна…"
                : member
                  ? "Хадгалах"
                  : "Урилга үүсгэх"}
            </Button>
          </div>
        </form>
      </FeatureDialog>
    </>
  );
}
