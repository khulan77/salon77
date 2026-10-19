import { BookingSettings } from "@/components/booking-settings";
import { SettingsTabs, isSettingsSection } from "@/components/settings-tabs";
import { discountedPrice } from "@/lib/pricing";
import { smsDelivers } from "@/lib/notifications/provider";
import { inviteEmailReady } from "@/lib/notifications/platform-email";
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
import { BranchSlots } from "@/components/branch-slots";
import { peekOptions } from "@/lib/services/bookings";
import { SetupSteps } from "@/components/setup-steps";
import { ProfileChecklist } from "@/components/profile-checklist";
import { profileChecklist } from "@/lib/services/publish";
import { ReviewsBoard } from "@/components/reviews-board";
import { listReviews } from "@/lib/services/reviews";
import { CustomerDirectory } from "@/components/customer-directory";
import { StaffDirectory } from "@/components/staff-directory";
import { StaffSchedules } from "@/components/staff-schedules";
import { Inventory } from "@/components/inventory";
import { SupportDesk } from "@/components/support-desk";
import { listOwnFeedback } from "@/lib/services/feedback";
import { readInventory } from "@/lib/services/inventory";
import { readStaff, readSchedules } from "@/lib/services/staff";
import { moduleAllowed } from "@/lib/access";
import { ServiceCatalog } from "@/components/service-catalog";
import { db } from "@/lib/db";
import { readCatalog } from "@/lib/services/catalog";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { adminActor, adminData, setupState, teamLists } from "@/lib/admin-data";
import { modules } from "@/lib/navigation";
import { Branches } from "@/components/branches";
import { readBranchGalleries } from "@/lib/services/salon-media";
import { Team } from "@/components/team";
// The address visitors use, so the share link works on any domain.
async function requestOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : "";
}
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
    tab?: string;
  }>;
}) {
  const { module } = await params;
  const item = modules.find((i) => i.href === `/${module}`);
  if (!item) notFound();
  // The member is cached for the request; the page's own reads then run
  // alongside the layout's branch list instead of after it.
  const actor = await adminActor();
  const role = actor?.role ?? "SALON_OWNER";
  const approved = (await adminData()).billing.state !== "PENDING";
  if (!approved && !moduleAllowed(role, `/${module}`, false))
    return (
      <section className="panel empty-page">
        <h1>Баталгаажсаны дараа нээгдэнэ</h1>
        <p>
          Салон тань хянагдаж байна. Энэ хооронд үйлчилгээ, ажилтан, ажлын цаг,
          салбар болон зургаа бэлдээрэй.
        </p>
        <Link href="/onboarding/review">Хүсэлтийн төлөв харах</Link>
      </section>
    );
  if (!moduleAllowed(role, `/${module}`))
    return (
      <section className="panel empty-page">
        <h1>Хандах эрхгүй</h1>
        <p>Энэ хэсэгт хандах эрхгүй байна.</p>
        <Link href="/">Нүүр хуудас руу буцах</Link>
      </section>
    );
  if (module === "settings") {
    const salonId = actor?.salonId;
    const [data, salon, services, checklist] = await Promise.all([
      adminData(),
      salonId
        ? db.salon.findUnique({
            where: { id: salonId },
            select: {
              instagram: true,
              facebook: true,
              phone: true,
              description: true,
              serviceTypes: true,
            },
          })
        : null,
      salonId
        ? db.service.findMany({
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
          })
        : [],
      salonId && role === "SALON_OWNER" ? profileChecklist(db, salonId) : null,
    ]);
    const { tab } = await searchParams;
    return (
      <BookingSettings
        section={isSettingsSection(tab) ? tab : "salon"}
        checklist={checklist && <ProfileChecklist items={checklist} />}
        preview={data.preview}
        salonName={data.salonName}
        slug={data.slug}
        salonId={data.salonId}
        logoUrl={data.logoUrl}
        instagram={salon?.instagram ?? ""}
        facebook={salon?.facebook ?? ""}
        phone={salon?.phone ?? ""}
        description={salon?.description ?? ""}
        serviceTypes={salon?.serviceTypes ?? []}
        origin={await requestOrigin()}
        branches={data.branches.filter((b) => b.active)}
        smsReady={smsDelivers()}
        services={services.map((s) => ({
          name: s.name,
          durationMinutes: s.durationMinutes,
          listPriceMnt: s.priceMnt,
          priceMnt: discountedPrice(s.priceMnt, s.discountPercent),
        }))}
      />
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
    const [data, timesheet] = await Promise.all([
      adminData(),
      actor
        ? readTimesheet(db, actor, range)
        : { ...range, today, staff: [], marks: [] },
    ]);
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
    const [data, report] = await Promise.all([
      adminData(),
      actor ? revenueReport(db, actor, range) : emptyReport(range),
    ]);
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
        preview={!actor}
        owner={role === "SALON_OWNER"}
        initialId={(await searchParams).id}
      />
    );
  if (module === "calendar" || module === "bookings") {
    const [data, staff, catalog, peek, setup, checklist] = await Promise.all([
      adminData(),
      actor ? readStaff(db, actor) : [],
      actor ? readCatalog(db, actor) : { services: [], categories: [] },
      actor ? peekOptions(db, actor) : null,
      module === "calendar" ? setupState() : null,
      module === "calendar" && actor?.role === "SALON_OWNER"
        ? profileChecklist(db, actor.salonId)
        : null,
    ]);
    const setupDone = setup && setup.services && setup.staff && setup.hours;
    return (
      <>
        {setup && <SetupSteps data={{ ...data, setup }} />}
        {/* The first steps come first; the rest of the profile after them. */}
        {setupDone && checklist && <ProfileChecklist items={checklist} />}
        <BookingCalendar
          mode={module}
          preview={data.preview}
          options={{
            branches: data.branches.filter((b) => b.active),
            categories: catalog.categories.filter((c) => c.active),
            services: catalog.services.filter(
              (s) =>
                s.active &&
                catalog.categories.some(
                  (c) => c.id === s.categoryId && c.active,
                ),
            ),
            staff: staff.filter((s) => s.active),
          }}
        />
        {module === "calendar" && peek && !data.preview && (
          <BranchSlots options={peek} />
        )}
      </>
    );
  }
  if (module === "reviews")
    return (
      <ReviewsBoard
        owner={role === "SALON_OWNER"}
        initial={actor ? await listReviews(db, actor) : []}
      />
    );
  if (module === "branches") {
    const [data, photos] = await Promise.all([
      adminData(),
      actor ? readBranchGalleries(db, actor) : {},
    ]);
    return <Branches data={data} photos={photos} />;
  }
  if (module === "team") {
    const [data, lists] = await Promise.all([adminData(), teamLists()]);
    return (
      <>
        <SettingsTabs active="/team" />
        <Team data={{ ...data, ...lists }} emailReady={inviteEmailReady()} />
      </>
    );
  }
  if (module === "services") {
    const [data, catalog, salon] = await Promise.all([
      adminData(),
      actor ? readCatalog(db, actor) : { categories: [], services: [] },
      actor
        ? db.salon.findUnique({
            where: { id: actor.salonId },
            select: { serviceTypes: true },
          })
        : null,
    ]);
    return (
      <ServiceCatalog
        data={data}
        catalog={catalog}
        serviceTypes={salon?.serviceTypes ?? []}
      />
    );
  }
  if (module === "employees") {
    // The schedule already carries the staff list; no second staff read.
    const [data, lists, catalog, schedule] = await Promise.all([
      adminData(),
      teamLists(),
      actor ? readCatalog(db, actor) : { services: [], categories: [] },
      actor ? readSchedules(db, actor) : { staff: [], hours: [], timeOff: [] },
    ]);
    return (
      <StaffDirectory
        data={{ ...data, ...lists }}
        staff={schedule.staff}
        catalog={catalog}
        hours={schedule.hours}
      />
    );
  }
  if (module === "support")
    return (
      <SupportDesk
        preview={!actor}
        initial={actor ? await listOwnFeedback(db, actor) : []}
      />
    );
  if (module === "inventory") {
    const [data, products] = await Promise.all([
      adminData(),
      actor ? readInventory(db, actor) : [],
    ]);
    return <Inventory data={data} products={products} />;
  }
  if (module === "schedules") {
    const [data, schedule] = await Promise.all([
      adminData(),
      actor ? readSchedules(db, actor) : { staff: [], hours: [], timeOff: [] },
    ]);
    return (
      <StaffSchedules
        data={data}
        schedule={schedule}
        initialStaff={(await searchParams).staffId}
      />
    );
  }
  notFound();
}
