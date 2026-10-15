import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Lock, Phone } from "lucide-react";
import {
  membership,
  HttpError,
  salonSuspended,
  salonUnapproved,
} from "@/lib/auth";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { salonBilling } from "@/lib/services/billing";
import { site, formatSitePhone } from "@/lib/site";
import { formatMnt } from "@/lib/ui-language";
import { localStamp } from "@/lib/business-time";
import { signOut } from "@/app/auth/actions";
import { CopyValue } from "@/components/copy-value";
export const dynamic = "force-dynamic";
export const metadata = { title: "Төлбөр · Salon77" };
const date = (iso: string) => localStamp(iso).slice(0, 10).replace(/-/g, ".");
// Reachable even after access ran out, so the owner always sees what to pay.
export default async function Page() {
  if (!configured) redirect("/");
  let member;
  try {
    member = await membership({ unpaid: true });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/sign-in");
    if (e instanceof HttpError && e.message === salonSuspended)
      redirect("/suspended");
    if (e instanceof HttpError && e.message === salonUnapproved)
      redirect("/onboarding/review");
    redirect("/onboarding");
  }
  const billing = await salonBilling(db, member.salonId);
  const expired = billing.state === "EXPIRED";
  const owner = member.role === "SALON_OWNER";
  const phone = site.phone && formatSitePhone(site.phone);
  return (
    <div className="onboarding-page">
      <main className="onboarding-container">
        <section className="onboarding-card billing-page">
          <span className="eyebrow">САРЫН ТӨЛБӨР</span>
          <h1>{billing.name}</h1>
          <div className={`billing-status ${expired ? "expired" : ""}`}>
            {expired ? <Lock size={20} /> : <CalendarClock size={20} />}
            <div>
              <strong>
                {expired
                  ? billing.trial
                    ? "Үнэгүй туршилт дууссан"
                    : "Төлсөн хугацаа дууссан"
                  : billing.state === "TRIAL"
                    ? `Үнэгүй туршилт · ${billing.daysLeft} хоног үлдсэн`
                    : billing.state === "PAID"
                      ? `Төлсөн · ${billing.daysLeft} хоног үлдсэн`
                      : "Төлбөр шаардлагагүй"}
              </strong>
              {expired
                ? "Удирдлага болон онлайн захиалгын хуудас түр хаагдсан. Төлбөр орсны дараа бүгд дахин нээгдэж, мэдээлэл тань хэвээр үлдэнэ."
                : billing.until
                  ? `${date(billing.until)} хүртэл ашиглана.`
                  : ""}
            </div>
          </div>
          {billing.amountMnt !== null && billing.state !== "FREE" && (
            <div className="billing-due">
              {!billing.customPrice && (
                <>
                  <div>
                    <span>Нэг салбарын сарын төлбөр</span>
                    <span>{formatMnt(billing.pricePerBranchMnt ?? 0)}</span>
                  </div>
                  <div>
                    <span>Идэвхтэй салбар</span>
                    <span>{billing.branches}</span>
                  </div>
                </>
              )}
              <div>
                <span>30 хоногийн төлбөр</span>
                <span>{formatMnt(billing.amountMnt)}</span>
              </div>
            </div>
          )}
          {owner && billing.state !== "FREE" && (
            <>
              <div className="settings-subtitle">Төлбөр шилжүүлэх данс</div>
              <dl className="billing-bank">
                <div>
                  <dt>Банк</dt>
                  <dd>{site.bank.name}</dd>
                </div>
                <div>
                  <dt>Хүлээн авагч</dt>
                  <dd>{site.bank.holder}</dd>
                </div>
                <div>
                  <dt>Дансны дугаар</dt>
                  <dd>
                    <CopyValue
                      value={site.bank.account}
                      label="Дансны дугаар"
                    />
                  </dd>
                </div>
                <div>
                  <dt>IBAN</dt>
                  <dd>
                    <CopyValue
                      value={site.bank.iban.replace(/(.{4})(?=.)/g, "$1 ")}
                      label="IBAN"
                    />
                  </dd>
                </div>
                <div>
                  <dt>Гүйлгээний утга</dt>
                  <dd>
                    <CopyValue
                      value={member.salon.slug}
                      label="Гүйлгээний утга"
                    />
                  </dd>
                </div>
              </dl>
              <p>
                Гүйлгээний утга дээр салоныхоо хаягийг заавал бичээрэй. Төлбөр
                орсныг бид шалгаад 30 хоногийн эрхийг нээнэ. Хугацаа дуусахаас
                өмнө төлбөл үлдсэн хоног тань хасагдахгүй.
              </p>
            </>
          )}
          {billing.payments.length > 0 && (
            <>
              <div className="settings-subtitle">Төлбөрийн түүх</div>
              <ul className="billing-history">
                {billing.payments.map((p) => (
                  <li key={p.id}>
                    <span>
                      {date(p.periodStart)} – {date(p.periodEnd)}
                    </span>
                    <span>{formatMnt(p.amountMnt)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="billing-actions">
            {phone && (
              <a
                className="suspended-contact"
                href={`tel:${site.phone.replace(/\s/g, "")}`}
              >
                <Phone size={16} /> {phone}
              </a>
            )}
            {!expired && <Link href="/">Удирдлагын хэсэгт буцах</Link>}
            <form action={signOut}>
              <button type="submit" className="onboarding-sign-out">
                Гарах
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
