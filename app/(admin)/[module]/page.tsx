import { BookingSettings } from "@/components/booking-settings";
import { BookingCalendar } from "@/components/booking-calendar";
import { CustomerDirectory } from "@/components/customer-directory";
import { StaffDirectory } from "@/components/staff-directory";
import { StaffSchedules } from "@/components/staff-schedules";
import { readStaff, readSchedules } from "@/lib/services/staff";
import { moduleAllowed } from "@/lib/access";
import { ServiceCatalog } from "@/components/service-catalog";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { readCatalog } from "@/lib/services/catalog";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { adminData } from "@/lib/admin-data";
import { navigation } from "@/lib/navigation";
import { Branches } from "@/components/branches";
import { Team } from "@/components/team";
import { Button } from "@/components/ui/button";
const descriptions: Record<string, string> = {
  "salon-page":
    "Салоноо цахимаар танилцуулах хуудас дараагийн шатанд нэмэгдэнэ.",
  support:
    "Систем дотроос тусламж авах боломж дараагийн шатанд нэмэгдэнэ. Одоогоор тохируулах зааврыг төслийн баримт бичгээс үзнэ үү.",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ staffId?: string; id?: string }>;
}) {
  const { module } = await params;
  const item = navigation
    .flatMap((g) => g.items)
    .find((i) => i.href === `/${module}`);
  if (!item) notFound();
  const data = await adminData();
  if (!moduleAllowed(data.role, `/${module}`))
    return (
      <section className="panel empty-page">
        <h1>Хандах эрхгүй</h1>
        <p>Энэ хэсэгт хандах эрхгүй байна.</p>
        <Link href="/">Хяналтын самбарт буцах</Link>
      </section>
    );
  if (module === "settings") return <BookingSettings preview={data.preview} />;
  if (module === "customers")
    return (
      <CustomerDirectory
        preview={data.preview}
        owner={data.role === "SALON_OWNER"}
        initialId={(await searchParams).id}
      />
    );
  if (module === "calendar" || module === "bookings") {
    const actor = configured ? actorFromMember(await membership()) : null;
    const [staff, catalog] = actor
      ? await Promise.all([readStaff(db, actor), readCatalog(db, actor)])
      : [[], { services: [], categories: [] }];
    return (
      <BookingCalendar
        mode={module}
        preview={data.preview}
        options={{
          branches: data.branches.filter((b) => b.active),
          services: catalog.services.filter(
            (s) =>
              s.active &&
              catalog.categories.some((c) => c.id === s.categoryId && c.active),
          ),
          staff: staff.filter((s) => s.active),
        }}
      />
    );
  }
  if (module === "branches") return <Branches data={data} />;
  if (module === "team") return <Team data={data} />;
  if (module === "services")
    return (
      <ServiceCatalog
        data={data}
        catalog={
          configured
            ? await readCatalog(db, actorFromMember(await membership()))
            : { categories: [], services: [] }
        }
      />
    );
  if (module === "employees") {
    const actor = configured ? actorFromMember(await membership()) : null;
    const [staff, catalog] = actor
      ? await Promise.all([readStaff(db, actor), readCatalog(db, actor)])
      : [[], { services: [], categories: [] }];
    return <StaffDirectory data={data} staff={staff} catalog={catalog} />;
  }
  if (module === "schedules")
    return (
      <StaffSchedules
        data={data}
        schedule={
          configured
            ? await readSchedules(db, actorFromMember(await membership()))
            : { staff: [], hours: [], timeOff: [] }
        }
        initialStaff={(await searchParams).staffId}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ТАНЫ УДИРДЛАГЫН ХЭСЭГ</div>
          <h1>
            {item.title}
            <span className="heading-dot">.</span>
          </h1>
          <p>Бизнесээ хөгжүүлэх шинэ боломжууд.</p>
        </div>
      </div>
      <section className="panel empty-page">
        <div className="empty-page-icon">
          <item.icon size={28} strokeWidth={1.3} />
        </div>
        <span className="subtle-pill">ДАРААГИЙН ШАТАНД НЭМЭГДЭНЭ</span>
        <h2>Шинэ боломж бэлдэж байна</h2>
        <p>
          {descriptions[module] ??
            `«${item.title}» хэсэг дараагийн шатанд нэмэгдэнэ. Салоны өдөр тутмын ажлыг хялбарчлах боломжуудыг үе шаттайгаар хөгжүүлж байна.`}
        </p>
        {module === "salon-page" && data.slug && (
          <div className="url-preview">
            Таны сонгосон хаяг: <strong>salon77.mn/{data.slug}</strong>{" "}
            <ArrowUpRight size={13} style={{ display: "inline" }} />
          </div>
        )}
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft size={14} /> Хяналтын самбарт буцах
          </Link>
        </Button>
      </section>
    </>
  );
}
