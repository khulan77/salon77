import { redirect } from "next/navigation";
import { Lock, Phone } from "lucide-react";
import { sessionUser } from "@/lib/auth";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { site, formatSitePhone } from "@/lib/site";
import { signOut } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Салон түр хаагдсан · Salon77" };
// Members of a salon the platform closed (usually an unpaid monthly fee).
export default async function Page() {
  if (!configured) redirect("/");
  const user = await sessionUser().catch(() => null);
  if (!user) redirect("/sign-in");
  const member = await db.salonMember.findFirst({
    where: { userId: user.id, active: true, salon: { status: "SUSPENDED" } },
    select: { salon: { select: { name: true } } },
  });
  if (!member) redirect("/");
  const phone = site.phone && formatSitePhone(site.phone);
  return (
    <div className="onboarding-page">
      <main className="onboarding-container">
        <section className="onboarding-card suspended-card">
          <span className="suspended-icon">
            <Lock size={22} />
          </span>
          <h1>«{member.salon.name}» түр хаагдсан</h1>
          <p>
            Сарын төлбөр төлөгдөөгүй тул салоны удирдлага болон онлайн захиалгын
            хуудас түр хаагдлаа. Төлбөрөө төлсний дараа бүгд дахин нээгдэж,
            мэдээлэл тань хэвээр үлдэнэ.
          </p>
          {phone && (
            <a
              className="suspended-contact"
              href={`tel:${site.phone.replace(/\s/g, "")}`}
            >
              <Phone size={16} /> {phone}
            </a>
          )}
          <form action={signOut}>
            <button type="submit" className="onboarding-sign-out">
              Гарах
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
