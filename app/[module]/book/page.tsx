import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { publicCatalog } from "@/lib/services/bookings";
import { HttpError } from "@/lib/errors";
import { publicBookingClosed } from "@/lib/booking-settings";
import { BookingWizard } from "@/components/booking-wizard";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Цаг захиалах · Salon77",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  if (!configured) notFound();
  const { module: slug } = await params;
  let catalog;
  try {
    catalog = await publicCatalog(db, slug);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  return (
    <main className="public-booking">
      <header>
        <span className="eyebrow">SALON77</span>
        <h1>{catalog.salon.name}</h1>
        <p>Өөрт тохирох цагаа сонгоорой.</p>
      </header>
      <section className="panel public-booking-card">
        {catalog.policy.publicBookingEnabled ? (
          <BookingWizard
            slug={slug}
            options={catalog}
            policy={catalog.policy}
          />
        ) : (
          <p role="status">{publicBookingClosed}</p>
        )}
      </section>
    </main>
  );
}
