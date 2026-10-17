"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Users,
  Pencil,
  XCircle,
  Copy,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Headset,
  Check,
  Trash2,
} from "lucide-react";
import { localStamp } from "@/lib/business-time";
import type { TeamData } from "@/lib/admin-data";
import { Button } from "./ui/button";
import { FeatureDialog, Feedback } from "./ui/feature-dialog";
import { formatTimeAgo, roleLabel, userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { requestJson } from "@/lib/client-request";
const statusLabels: Record<string, string> = {
  DRAFT: "Хуучин ноорог",
  PENDING: "Хүлээгдэж байна",
  ACCEPTED: "Нэгдсэн",
  EXPIRED: "Хугацаа дууссан",
  CANCELLED: "Цуцалсан",
};
const open = ["DRAFT", "PENDING", "EXPIRED"];
const day = (iso: string) => localStamp(iso).slice(0, 10).replace(/-/g, ".");
type Invitation = TeamData["invitations"][number];
type Created = {
  name: string;
  email: string;
  link: string;
  emailed: boolean;
  replaced: boolean;
  expiresAt: string;
};
export function Team({
  data,
  emailReady,
}: {
  data: TeamData;
  emailReady: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<
    TeamData["members"][number] | "invite" | null
  >(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const branches = data.branches.filter((b) => b.active);
  const branchName = (ids: string[]) =>
    data.branches
      .filter((b) => ids.includes(b.id))
      .map((b) => b.name)
      .join(", ") || "Салбаргүй";
  // Most recent sign-in first; members who never signed in go last.
  const members = [...data.members].sort((a, b) =>
    (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? ""),
  );
  const latest = members[0];
  const waiting = data.invitations.filter((i) => open.includes(i.status));
  const past = data.invitations.filter((i) => !open.includes(i.status));
  async function invite(input: {
    name: string;
    email: string;
    branchId?: string;
  }) {
    const result = await requestJson<{
      invitePath: string;
      emailed: boolean;
      replaced: boolean;
      expiresAt: string;
    }>("/api/invitations", "POST", input);
    setCopied(false);
    setCreated({
      name: input.name,
      email: input.email,
      link: new URL(result.invitePath, window.location.origin).href,
      emailed: result.emailed,
      replaced: result.replaced,
      expiresAt: result.expiresAt,
    });
    setMessage("");
    router.refresh();
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      if (editing === "invite") {
        await invite({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          ...(form.get("branchId")
            ? { branchId: String(form.get("branchId")) }
            : {}),
        });
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
        const chosen = form.getAll("branches").map(String);
        await requestJson(`/api/members?id=${editing.id}`, "PATCH", {
          role: String(form.get("role") ?? editing.role),
          branchIds: branches.length === 1 ? [branches[0].id] : chosen,
          active,
        });
        setMessage("Гишүүний эрхийг хадгаллаа.");
        router.refresh();
      }
      setEditing(null);
    } catch (e) {
      setError(userFacingError(e, "Мэдээллийг хадгалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  async function remove(m: TeamData["members"][number]) {
    if (
      !window.confirm(
        `«${m.name}»-г багаас хасах уу? Энэ салонд нэвтрэх эрх нь хаагдана. Бүртгэсэн захиалгууд хэвээр үлдэнэ.`,
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/members?id=${m.id}`, "DELETE");
      setMessage(`«${m.name}»-г багаас хаслаа.`);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Гишүүнийг хасаж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  async function reissue(i: Invitation) {
    setPending(true);
    setError("");
    try {
      await invite({ name: i.name, email: i.email, branchId: i.branchIds[0] });
    } catch (e) {
      setError(userFacingError(e, "Шинэ линк үүсгэж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  async function cancel(id: string) {
    if (
      !window.confirm(
        "Энэ урилгыг цуцлах уу? Линкээр дахин нэгдэх боломжгүй болно.",
      )
    )
      return;
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/invitations?id=${id}`, "PATCH");
      setMessage("Урилгыг цуцаллаа.");
      setCreated(null);
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Урилгыг цуцалж чадсангүй."));
    } finally {
      setPending(false);
    }
  }
  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError("");
    } catch {
      setError("Линкийг сонгоод гараар хуулна уу.");
    }
  }
  const member = editing && editing !== "invite" ? editing : null;
  const legacyRole = member && member.role !== "RECEPTIONIST";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">БАГ</div>
          <h1>
            Баг ба эрх<span className="heading-dot">.</span>
          </h1>
          <p>Ресепшнээ урьж, аль салбарт ажиллахыг нь заагаарай.</p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setEditing("invite");
          }}
        >
          <Plus size={15} />
          Ресепшн урих
        </Button>
      </div>
      <section className="role-guide" aria-label="Эрхийн тайлбар">
        <div className="role-card">
          <span className="role-card-icon">
            <ShieldCheck size={16} />
          </span>
          <div>
            <strong>Админ</strong>
            <p>
              Салоныг бүртгүүлсэн хүн. Бүх салбар, тайлан, тохиргоо, баг,
              төлбөрийг удирдана.
            </p>
          </div>
        </div>
        <div className="role-card">
          <span className="role-card-icon">
            <Headset size={16} />
          </span>
          <div>
            <strong>Ресепшн</strong>
            <p>
              Өөрийн салбарын захиалгыг нэмж, засаж, цуцална; үйлчлүүлэгчдийг
              харна; ажилтан, үйлчилгээг зураг, утастай нь нэмж засна. Бусад
              салбарын зөвхөн сул цагийг харна. Тайлан, тохиргоо, баг, төлбөр
              харагдахгүй.
            </p>
          </div>
        </div>
      </section>
      {!editing && <Feedback error={error} message={message} />}
      {created && (
        <section className="panel invite-created" aria-live="polite">
          <div className="invite-created-head">
            <Check size={16} />
            <strong>{created.name}-д урилга үүслээ</strong>
          </div>
          <p>
            {created.emailed
              ? `${created.email} хаяг руу имэйлээр явууллаа. Хүсвэл линкийг Messenger-ээр давхар явуулж болно.`
              : "Линкийг хуулаад Messenger эсвэл өөр сувгаар зөвхөн уригдсан хүнд явуулна уу."}
            {created.replaced && " Өмнөх линк хүчингүй боллоо."} Линк{" "}
            {day(created.expiresAt)} хүртэл хүчинтэй.
          </p>
          <div className="invite-link-row">
            <input
              readOnly
              aria-label="Урилгын линк"
              value={created.link}
              onFocus={(e) => e.target.select()}
            />
            <Button onClick={() => copy(created.link)}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Хуулсан" : "Урилгын линкийг хуулах"}
            </Button>
          </div>
          <small>
            Аюулгүй байдлын үүднээс линкийг зөвхөн одоо харуулна. Дараа хэрэгтэй
            бол «Шинэ линк» товчоор дахин үүсгэнэ.
          </small>
        </section>
      )}
      {latest?.lastLoginAt && (
        <section className="panel last-login" aria-label="Сүүлд нэвтэрсэн">
          <span className="last-login-icon">
            <LogIn size={16} />
          </span>
          <div>
            <span>Хамгийн сүүлд нэвтэрсэн</span>
            <strong>
              {latest.name} · {roleLabel(latest.role)}
            </strong>
          </div>
          <time dateTime={latest.lastLoginAt} suppressHydrationWarning>
            {formatTimeAgo(latest.lastLoginAt)}
            <small>{localStamp(latest.lastLoginAt).replace("T", " ")}</small>
          </time>
        </section>
      )}
      {members.length ? (
        <section className="panel team-list" aria-label="Гишүүд">
          <div className="panel-heading">
            <h2>Гишүүд</h2>
          </div>
          <ul>
            {members.map((m) => (
              <li className="team-row" key={m.id}>
                <div className="team-person">
                  <strong>{m.name}</strong>
                  <small>{m.email}</small>
                </div>
                <div className="team-meta">
                  <span className="role-badge">{roleLabel(m.role)}</span>
                  <span>
                    {m.role === "SALON_OWNER"
                      ? "Бүх салбар"
                      : branchName(m.branchIds)}
                  </span>
                  <span className={m.active ? "" : "muted-text"}>
                    {m.active ? "Идэвхтэй" : "Идэвхгүй"}
                  </span>
                  <span className="muted-text">
                    {m.lastLoginAt ? (
                      <time
                        dateTime={m.lastLoginAt}
                        title={localStamp(m.lastLoginAt).replace("T", " ")}
                        suppressHydrationWarning
                      >
                        Сүүлд нэвтэрсэн: {formatTimeAgo(m.lastLoginAt)}
                      </time>
                    ) : (
                      "Нэвтэрч байгаагүй"
                    )}
                  </span>
                </div>
                <div className="team-actions">
                  {m.role !== "SALON_OWNER" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setError("");
                        setEditing(m);
                      }}
                    >
                      <Pencil size={13} />
                      Засах
                    </Button>
                  )}
                  {m.role !== "SALON_OWNER" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="team-remove"
                      disabled={pending}
                      onClick={() => remove(m)}
                    >
                      <Trash2 size={13} />
                      Устгах
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="panel empty-page">
          <div className="empty-page-icon">
            <Users size={28} />
          </div>
          <h2>Багаа бүрдүүлээрэй</h2>
          <p>Ресепшнээ урихад энд харагдана.</p>
        </section>
      )}
      {waiting.length > 0 && (
        <section className="panel team-list" aria-label="Хүлээгдэж буй урилга">
          <div className="panel-heading">
            <h2>Хүлээгдэж буй урилга</h2>
          </div>
          <ul>
            {waiting.map((i) => (
              <InvitationRow
                key={i.id}
                invitation={i}
                branch={branchName(i.branchIds)}
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || data.preview}
                  onClick={() => reissue(i)}
                >
                  <RefreshCw size={13} />
                  Шинэ линк
                </Button>
                {i.status !== "EXPIRED" && (
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
              </InvitationRow>
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <details className="panel team-list team-history">
          <summary>Өмнөх урилгууд ({past.length})</summary>
          <ul>
            {past.map((i) => (
              <InvitationRow
                key={i.id}
                invitation={i}
                branch={branchName(i.branchIds)}
              />
            ))}
          </ul>
        </details>
      )}
      <FeatureDialog
        open={!!editing}
        title={member ? "Эрх засах" : "Ресепшн урих"}
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
          {legacyRole && (
            <label className="field">
              Эрх
              <select name="role" defaultValue={member.role}>
                <option value={member.role}>
                  {roleLabel(member.role)} (хуучин эрх)
                </option>
                <option value="RECEPTIONIST">Ресепшн</option>
              </select>
            </label>
          )}
          {branches.length > 1 &&
            (member ? (
              <fieldset>
                <legend>Салбар</legend>
                {branches.map((b) => (
                  <label className="check-field" key={b.id}>
                    <input
                      type="checkbox"
                      name="branches"
                      value={b.id}
                      defaultChecked={member.branchIds.includes(b.id)}
                    />
                    {b.name}
                  </label>
                ))}
              </fieldset>
            ) : (
              <label className="field">
                Салбар
                <select name="branchId" required defaultValue="">
                  <option value="" disabled>
                    Аль салбарын ресепшн бэ?
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          {branches.length === 1 && !member && (
            <p className="field-hint">Салбар: {branches[0].name}</p>
          )}
          {!branches.length && (
            <p className="notice">Эхлээд идэвхтэй салбар нэмнэ үү.</p>
          )}
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
          {!member && (
            <div className="notice invite-dialog-note">
              <strong>Нууц үгийг хэн ч урьдчилж үүсгэхгүй.</strong> Ресепшн
              линкээр орж нууц үгээ өөрөө үүсгэнэ.{" "}
              {emailReady
                ? "Линкийг имэйлээр явуулахаас гадна хуулж авах боломжтой."
                : "Имэйл илгээлт тохируулаагүй тул линкийг хуулж явуулна."}
            </div>
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
              Болих
            </Button>
            <Button disabled={pending || data.preview || !branches.length}>
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
function InvitationRow({
  invitation: i,
  branch,
  children,
}: {
  invitation: Invitation;
  branch: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="team-row">
      <div className="team-person">
        <strong>{i.name}</strong>
        <small>{i.email}</small>
      </div>
      <div className="team-meta">
        <span className={`invite-status status-${i.status.toLowerCase()}`}>
          {statusLabels[i.status] ?? "Хүчингүй"}
        </span>
        <span>
          {roleLabel(i.role)} · {branch}
        </span>
        {i.status === "PENDING" && (
          <span className="muted-text">{day(i.expiresAt)} хүртэл хүчинтэй</span>
        )}
        {i.status === "EXPIRED" && (
          <span className="muted-text">Шинэ линк үүсгэж дахин явуулна уу</span>
        )}
      </div>
      {children && <div className="team-actions">{children}</div>}
    </li>
  );
}
