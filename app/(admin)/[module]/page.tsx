import { BookingSettings } from "@/components/booking-settings";
import { SettingsTabs } from "@/components/settings-tabs";
import { discountedPrice } from "@/lib/pricing";
import { smsProvider } from "@/lib/notifications/provider";
import { RevenueReport } from "@/components/revenue-report";
import { Timesheet } from "@/components/timesheet";
import { readTimesheet, timesheetQuery } from "@/lib/services/timesheet";
import {
  emptyReport,
  monthToDate,
  reportQuery,
  revenueReport,
} from "@/lib/services/reports";
import { BookingCalendar } from "@/components/booking-calendar";
import { CustomerDirectory } from "@/components/customer-directory";
import { StaffDirectory } from "@/components/staff-directory";
import { StaffSchedules } from "@/components/staff-schedules";
import { Inventory } from "@/components/inventory";
import { readInventory } from "@/lib/services/inventory";
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
import { modules } from "@/lib/navigation";
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
  searchParams: Promise<{
    staffId?: string;
    id?: string;
    from?: string;
    to?: string;
    branchId?: string;
  }>;
}) {
  const { module } = await params;
  const item = modules.find((i) => i.href === `/${module}`);
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
  if (module === "settings") {
    const salonId = configured ? (await membership()).salonId : null;
    const [salon, services] = salonId
      ? await Promise.all([
          db.salon.findUnique({
            where: { id: salonId },
            select: { coverUrl: true },
          }),
          db.service.findMany({
            where: {
              salonId,
              active: true,
              onlineBookable: true,
              category: { active: true },
            },
            select: {
              name: true,
              priceMnt: true,
              discountPercent: true,
              durationMinutes: true,
            },
            orderBy: { name: "asc" },
            take: 3,
          }),
        ])
      : [null, []];
    return (
      <>
        <SettingsTabs active="/settings" />
        <BookingSettings
          preview={data.preview}
          salonName={data.salonName}
          slug={data.slug}
          coverUrl={salon?.coverUrl ?? null}
          branches={data.branches.filter((b) => b.active)}
          smsReady={smsProvider() !== null}
          services={services.map((s) => ({
            name: s.name,
            durationMinutes: s.durationMinutes,
            listPriceMnt: s.priceMnt,
            priceMnt: discountedPrice(s.priceMnt, s.discountPercent),
          }))}
        />
      </>
    );
  }
  if (module === "timesheet") {
    const { from, to, branchId } = await searchParams;
    const parsed = timesheetQuery.safeParse({ from, to, branchId });
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Ulaanbaatar",
    });
    const month = today.slice(0, 7);
    const range = parsed.success
      ? parsed.data
      : {
          from: `${month}-01`,
          to: new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0))
            .toISOString()
            .slice(0, 10),
        };
    const timesheet = data.preview
      ? { ...range, today, staff: [], marks: [] }
      : await readTimesheet(db, actorFromMember(await membership()), range);
    return (
      <Timesheet
        data={timesheet}
        branches={data.branches}
        preview={data.preview}
      />
    );
  }
  if (module === "reports") {
    const { from, to, branchId } = await searchParams;
    const parsed = reportQuery.safeParse({ from, to, branchId });
    const range = parsed.success ? parsed.data : monthToDate();
    const report = data.preview
      ? emptyReport(range)
      : await revenueReport(db, actorFromMember(await membership()), range);
    return (
      <RevenueReport
        report={report}
        branches={data.branches}
        preview={data.preview}
      />
    );
  }
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
          categories: catalog.categories.filter((c) => c.active),
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
  if (module === "team")
    return (
      <>
        <SettingsTabs active="/team" />
        <Team data={data} />
      </>
    );
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
    const [staff, catalog, schedule] = actor
      ? await Promise.all([
          readStaff(db, actor),
          readCatalog(db, actor),
          readSchedules(db, actor),
        ])
      : [
          [],
          { services: [], categories: [] },
          { staff: [], hours: [], timeOff: [] },
        ];
    return (
      <StaffDirectory
        data={data}
        staff={staff}
        catalog={catalog}
        hours={schedule.hours}
      />
    );
  }
  if (module === "inventory") {
    const actor = configured ? actorFromMember(await membership()) : null;
    return (
      <Inventory
        data={data}
        products={actor ? await readInventory(db, actor) : []}
      />
    );
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
