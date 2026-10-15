import { BookingSettings } from "@/components/booking-settings";
import { SettingsTabs } from "@/components/settings-tabs";
import { discountedPrice } from "@/lib/pricing";
import { smsDelivers } from "@/lib/notifications/provider";
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
import { SetupSteps } from "@/components/setup-steps";
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
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { readCatalog } from "@/lib/services/catalog";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { adminData } from "@/lib/admin-data";
import { modules } from "@/lib/navigation";
import { Branches } from "@/components/branches";
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
        <Link href="/">Нүүр хуудас руу буцах</Link>
      </section>
    );
  if (module === "settings") {
    const salonId = configured ? (await membership()).salonId : null;
    const [salon, services] = salonId
      ? await Promise.all([
          db.salon.findUnique({
            where: { id: salonId },
            select: { coverUrl: true, instagram: true, facebook: true },
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
          salonId={data.salonId}
          logoUrl={data.logoUrl}
          instagram={salon?.instagram ?? ""}
          facebook={salon?.facebook ?? ""}
          origin={await requestOrigin()}
          coverUrl={salon?.coverUrl ?? null}
          branches={data.branches.filter((b) => b.active)}
          smsReady={smsDelivers()}
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
      <>
        {module === "calendar" && <SetupSteps data={data} />}
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
      </>
    );
  }
  if (module === "reviews")
    return (
      <ReviewsBoard
        owner={data.role === "SALON_OWNER"}
        initial={
          configured && !data.preview
            ? await listReviews(db, actorFromMember(await membership()))
            : []
        }
      />
    );
  if (module === "branches") return <Branches data={data} />;
  if (module === "team")
    return (
      <>
        <SettingsTabs active="/team" />
        <Team data={data} />
      </>
    );
  if (module === "services") {
    const actor = configured ? actorFromMember(await membership()) : null;
    const [catalog, salon] = actor
      ? await Promise.all([
          readCatalog(db, actor),
          db.salon.findUnique({
            where: { id: actor.salonId },
            select: { serviceTypes: true },
          }),
        ])
      : [{ categories: [], services: [] }, null];
    return (
      <ServiceCatalog
        data={data}
        catalog={catalog}
        serviceTypes={salon?.serviceTypes ?? []}
      />
    );
  }
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
  if (module === "support")
    return (
      <SupportDesk
        preview={data.preview}
        initial={
          configured
            ? await listOwnFeedback(db, actorFromMember(await membership()))
            : []
        }
      />
    );
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
  notFound();
}
